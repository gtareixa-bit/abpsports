const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Airtable = require('airtable');

const base = new Airtable.base(process.env.AIRTABLE_BASE_ID);
const TABLES = {
  SOCIOS: 'Socios y Competidores',
  SUSCRIPCIONES: 'Suscripciones',
  TARIFAS: 'Tarifas'
};

const TARIFA_MAP = {
  "Infantil": "recCPw1X3DikI4bu2",
  "Cadete": "recvMKhkFjAXP3fXB",
  "Juvenil": "recBuLC3gjX6uTRHq",
  "Senior · Boxeo y Kickboxing": "reczEik2ZEYakjoIl",
  "Krav Maga 1x/semana": "rechOJRKvO2Sdqmzn",
  "Krav Maga 2x/semana": "rec0SrfsitadadtHZ",
  "Socio": "recBuLC3gjX6uTRHq",
  "Competidor": "recBuLC3gjX6uTRHq"
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const sig = event.headers['stripe-signature'];
    if (!sig) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No Stripe signature found' })
      };
    }

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    console.log('✓ Stripe event received:', stripeEvent.type);

    if (stripeEvent.type === 'charge.succeeded' || stripeEvent.type === 'invoice.payment_succeeded') {
      const paymentData = stripeEvent.data.object;
      const customerId = paymentData.customer;
      const amountEUR = paymentData.amount / 100;

      console.log(`Processing payment: ${customerId} - ${amountEUR}€`);

      let customer;
      try {
        customer = await stripe.customers.retrieve(customerId);
      } catch (err) {
        console.error('Error retrieving customer from Stripe:', err.message);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Customer not found in Stripe' })
        };
      }

      const customerEmail = customer.email;
      const customerMetadata = customer.metadata || {};
      const tipoUsuario = customerMetadata.tipo_usuario || 'Socio';
      const socioId = customerMetadata.socio_id;

      console.log(`Customer: ${customerEmail}, tipo_usuario: ${tipoUsuario}`);

      let socioRecord;
      if (socioId) {
        try {
          const records = await base(TABLES.SOCIOS)
            .select({ filterByFormula: `{ID} = '${socioId}'` })
            .firstPage();
          if (records.length > 0) {
            socioRecord = records[0];
          }
        } catch (err) {
          console.error('Error finding socio by ID:', err.message);
        }
      }

      if (!socioRecord) {
        try {
          const records = await base(TABLES.SOCIOS)
            .select({
              filterByFormula: `{Email} = '${customerEmail}'`,
              pageSize: 1
            })
            .firstPage();
          if (records.length > 0) {
            socioRecord = records[0];
          }
        } catch (err) {
          console.error('Error finding socio by email:', err.message);
        }
      }

      if (!socioRecord) {
        console.error(`No socio found for email: ${customerEmail}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Socio not found in Airtable' })
        };
      }

      const socioId_final = socioRecord.id;
      console.log(`✓ Found socio: ${socioId_final}`);

      const tarifaId = TARIFA_MAP[tipoUsuario] || TARIFA_MAP['Socio'];
      console.log(`✓ Tarifa assigned: ${tipoUsuario} -> ${tarifaId}`);

      const today = new Date().toISOString().split('T')[0];
      const referencia = `${socioId_final} · ${tipoUsuario} · ${today}`;

      const fechaInicio = new Date();
      const periodoFin = new Date();
      periodoFin.setMonth(periodoFin.getMonth() + 1);
      const periodoFinStr = periodoFin.toISOString().split('T')[0];

      const suscripcionData = {
        fields: {
          'Referencia': referencia,
          'Socio': [socioId_final],
          'Tarifa': [tarifaId],
          'Estado': 'active',
          'Fecha_Inicio': fechaInicio.toISOString().split('T')[0],
          'Periodo_Fin': periodoFinStr,
          'Importe_EUR': amountEUR,
          'Stripe_Subscription_ID': customerId
        }
      };

      let suscripcionRecord;
      try {
        suscripcionRecord = await base(TABLES.SUSCRIPCIONES).create(
          suscripcionData.fields
        );
        console.log(`✓ Subscription created: ${suscripcionRecord.id}`);
      } catch (err) {
        console.error('Error creating subscription in Airtable:', err.message);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create subscription', details: err.message })
        };
      }

      const updateData = {
        'Estado_Cuota': 'Al corriente',
        'Ultima_Cuota_Fecha': fechaInicio.toISOString().split('T')[0],
        'Ultima_Cuota_Importe': amountEUR
      };

      try {
        await base(TABLES.SOCIOS).update(socioId_final, updateData);
        console.log(`✓ Socio updated: ${socioId_final}`);
      } catch (err) {
        console.error('Error updating socio:', err.message);
      }

      console.log('✓ Webhook processing completed successfully');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          subscription_id: suscripcionRecord.id,
          socio_id: socioId_final
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
