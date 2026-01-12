const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.production' });

async function testBrevoEmail() {
  try {
    console.log('📧 Test d\'envoi d\'email avec Brevo...\n');
    
    // Afficher la configuration (masquer le mot de passe)
    console.log('⚙️  Configuration SMTP:');
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log(`   Pass: ${process.env.SMTP_PASS?.substring(0, 20)}...`);
    console.log(`   From: ${process.env.EMAIL_FROM}\n`);
    
    // Créer le transporteur
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    console.log('🔄 Vérification de la connexion SMTP...');
    await transporter.verify();
    console.log('✅ Connexion SMTP réussie!\n');
    
    // Envoyer un email de test
    console.log('📨 Envoi d\'un email de test...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER, // Envoi à vous-même pour tester
      subject: '✅ RestauConnect - Test Email Production',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4CAF50;">🎉 Email Configuration Réussie!</h1>
          
          <p>Félicitations! Votre configuration email Brevo fonctionne parfaitement.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">✅ Configuration validée:</h3>
            <ul>
              <li>✅ SMTP: smtp-relay.brevo.com</li>
              <li>✅ Compte: ${process.env.SMTP_USER}</li>
              <li>✅ Limite: 300 emails/jour (gratuit)</li>
            </ul>
          </div>
          
          <p><strong>Prochaines étapes:</strong></p>
          <ol>
            <li>✅ MongoDB Atlas configuré</li>
            <li>✅ Email Brevo configuré</li>
            <li>⏭️  Configurer Cloudinary (images)</li>
            <li>⏭️  Déployer l'application</li>
          </ol>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px;">
            Cet email a été envoyé depuis RestauConnect<br>
            Date: ${new Date().toLocaleString('fr-FR')}
          </p>
        </div>
      `,
      text: `
RestauConnect - Test Email Production

Félicitations! Votre configuration email Brevo fonctionne parfaitement.

Configuration validée:
- SMTP: smtp-relay.brevo.com
- Compte: ${process.env.SMTP_USER}
- Limite: 300 emails/jour (gratuit)

Prochaines étapes:
1. ✅ MongoDB Atlas configuré
2. ✅ Email Brevo configuré
3. ⏭️  Configurer Cloudinary (images)
4. ⏭️  Déployer l'application

Date: ${new Date().toLocaleString('fr-FR')}
      `
    });
    
    console.log('✅ Email envoyé avec succès!\n');
    console.log('📊 Détails:');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Destinataire: ${process.env.SMTP_USER}`);
    console.log(`   Statut: ${info.response}\n`);
    
    console.log('='.repeat(60));
    console.log('✅ BREVO EMAIL EST PRÊT POUR LA PRODUCTION!');
    console.log('='.repeat(60));
    console.log('\n📬 Vérifiez votre boîte email (adiliobalde@gmail.com)');
    console.log('   pour voir l\'email de test!\n');
    
    console.log('📋 Configuration finale:');
    console.log('   1. ✅ MongoDB Atlas (Paris)');
    console.log('   2. ✅ Email Brevo (300/jour)');
    console.log('   3. ⏭️  Cloudinary (images)');
    console.log('   4. ⏭️  Déploiement\n');
    
  } catch (error) {
    console.error('❌ ERREUR:\n');
    console.error(`   Message: ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('🔍 DIAGNOSTIC:');
      console.error('   ❌ Authentification refusée');
      console.error('   📝 Vérifiez:');
      console.error('      1. La clé SMTP est correcte dans .env.production');
      console.error('      2. Le compte Brevo est actif');
      console.error('      3. L\'email SMTP_USER existe dans Brevo\n');
    } else if (error.code === 'ECONNECTION') {
      console.error('🔍 DIAGNOSTIC:');
      console.error('   ❌ Impossible de se connecter au serveur SMTP');
      console.error('   📝 Vérifiez votre connexion internet\n');
    } else {
      console.error(`   Stack: ${error.stack}\n`);
    }
  }
}

testBrevoEmail();
