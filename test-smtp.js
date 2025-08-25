import nodemailer from 'nodemailer';


async function testSMTP() {
  console.log('Testing SMTP Configuration...\n');
  
  // Display current configuration (without password)
  console.log('SMTP Configuration:');
  console.log(`Host: ${process.env.SMTP_HOST}`);
  console.log(`Port: ${process.env.SMTP_PORT}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`Password: ${process.env.SMTP_PASS ? '***configured***' : 'NOT SET'}\n`);

  try {
    // Create transporter with your SMTP settings
    const transporter = nodemailer.createTransport({
      host: 'mail.nebrix.dev',
      port: Number(465),
      secure: Boolean(true), // true for 465, false for other ports
      auth: {
        user: 'admin@nebrix.dev',
        pass: '3Be)avAFN@+o',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log('Step 1: Testing connection...');
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    console.log('Step 2: Sending test email...');
    // Send test email
    const info = await transporter.sendMail({
      from: "admin@nebrix.dev",
      to: 'hamidsiddiqi888@gmail.com', // Send to yourself for testing
      subject: 'SMTP Test - Nebrix AI Trading',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>SMTP Test Successful!</h2>
          <p>Your SMTP configuration is working correctly.</p>
          <p><strong>Test Details:</strong></p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST}</li>
            <li>Port: ${process.env.SMTP_PORT}</li>
            <li>User: ${process.env.SMTP_USER}</li>
            <li>Time: ${new Date().toLocaleString()}</li>
          </ul>
          <p>This email was sent from your Nebrix AI Trading platform.</p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Accepted: ${info.accepted.join(', ')}`);
    if (info.rejected.length > 0) {
      console.log(`Rejected: ${info.rejected.join(', ')}`);
    }
    
    console.log('\n🎉 SMTP test completed successfully!');
    console.log('Check your inbox for the test email.');

  } catch (error) {
    console.error('❌ SMTP test failed:');
    console.error(`Error: ${error.message}`);
    
    // Provide helpful troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    
    if (error.code === 'EAUTH') {
      console.log('- Authentication failed. Check your username and password.');
      console.log('- For Gmail, make sure you\'re using an App Password, not your regular password.');
      console.log('- Enable 2-factor authentication and generate an App Password.');
    } else if (error.code === 'ECONNECTION') {
      console.log('- Connection failed. Check your host and port settings.');
      console.log('- Make sure your firewall allows outbound connections on the SMTP port.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('- Connection timed out. Check your network connection.');
      console.log('- Try a different SMTP server or port.');
    }
    
    console.log('- Double-check your .env file configuration.');
    console.log('- Make sure all SMTP environment variables are set correctly.');
  }
}

// Run the test
testSMTP();
