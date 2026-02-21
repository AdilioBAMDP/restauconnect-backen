import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.auth.user,
    pass: config.email.smtp.auth.pass
  }
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: any[];
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    if (!config.notifications.emailEnabled) {
      logger.info('Email notifications disabled');
      return true;
    }

    const mailOptions = {
      from: `${config.email.from.name} <${config.email.from.address}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { messageId: result.messageId });
    return true;
  } catch (error) {
    logger.error('Email sending failed', error);
    return false;
  }
};

// Email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Bienvenue sur Web Spider !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Bienvenue sur RestauConnect !</h1>
        <p>Bonjour ${name},</p>
        <p>Nous sommes ravis de vous accueillir sur RestauConnect, la plateforme qui connecte les professionnels de la restauration.</p>
        <p>Vous pouvez maintenant :</p>
        <ul>
          <li>CrÃƒÂ©er votre profil professionnel</li>
          <li>Publier vos offres et demandes</li>
          <li>Contacter d'autres professionnels</li>
          <li>Ãƒâ€°changer via notre systÃƒÂ¨me de messagerie</li>
        </ul>
        <p style="margin-top: 30px;">
          <a href="${config.cors.origin[0]}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Commencer maintenant
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          L'ÃƒÂ©quipe Web Spider
        </p>
      </div>
    `
  }),

  newMessage: (senderName: string, message: string) => ({
    subject: `Nouveau message de ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Nouveau message</h1>
        <p>Vous avez reÃƒÂ§u un nouveau message de <strong>${senderName}</strong> :</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          ${message}
        </div>
        <p>
          <a href="${config.cors.origin[0]}/messages" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            RÃƒÂ©pondre au message
          </a>
        </p>
      </div>
    `
  }),

  newReview: (reviewerName: string, rating: number, comment: string) => ({
    subject: 'Nouvel avis reÃƒÂ§u',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Nouvel avis reÃƒÂ§u</h1>
        <p><strong>${reviewerName}</strong> a laissÃƒÂ© un avis sur votre profil :</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom: 12px;">
            ${'Ã¢Ëœâ€¦'.repeat(rating)}${'Ã¢Ëœâ€ '.repeat(5 - rating)} (${rating}/5)
          </div>
          <p>${comment}</p>
        </div>
        <p>
          <a href="${config.cors.origin[0]}/profile" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Voir mon profil
          </a>
        </p>
      </div>
    `
  }),

  listingMatch: (listingTitle: string, matchCount: number) => ({
    subject: `${matchCount} nouveaux profils correspondent ÃƒÂ  votre offre`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Nouveaux profils correspondants</h1>
        <p>Bonne nouvelle ! ${matchCount} nouveaux profils correspondent ÃƒÂ  votre offre :</p>
        <h3 style="color: #374151;">${listingTitle}</h3>
        <p>
          <a href="${config.cors.origin[0]}/listings" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Voir les profils
          </a>
        </p>
      </div>
    `
  }),

  passwordReset: (resetToken: string) => ({
    subject: 'RÃƒÂ©initialisation de votre mot de passe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">RÃƒÂ©initialisation de mot de passe</h1>
        <p>Vous avez demandÃƒÂ© la rÃƒÂ©initialisation de votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour crÃƒÂ©er un nouveau mot de passe :</p>
        <p>
          <a href="${config.cors.origin[0]}/reset-password?token=${resetToken}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            RÃƒÂ©initialiser mon mot de passe
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Ce lien expire dans 1 heure. Si vous n'avez pas demandÃƒÂ© cette rÃƒÂ©initialisation, ignorez cet email.
        </p>
      </div>
    `
  }),

  emailVerification: (verificationToken: string) => ({
    subject: 'VÃ©rifiez votre adresse email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">VÃ©rification d'email</h1>
        <p>Merci de vous Ãªtre inscrit sur Web Spider !</p>
        <p>Pour activer votre compte, cliquez sur le lien ci-dessous :</p>
        <p>
          <a href="${config.cors.origin[0]}/verify-email?token=${verificationToken}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            VÃ©rifier mon email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Ce lien expire dans 24 heures.
        </p>
      </div>
    `
  }),

  approvalWithCredentials: (name: string, email: string, temporaryPassword: string, role: string) => ({
    subject: 'âœ… Votre inscription a Ã©tÃ© approuvÃ©e - RestauConnect',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: #10b981; color: white; border-radius: 50%; width: 60px; height: 60px; line-height: 60px; font-size: 30px; margin-bottom: 20px;">
              âœ“
            </div>
            <h1 style="color: #059669; margin: 0;">Inscription ApprouvÃ©e !</h1>
          </div>
          
          <p style="font-size: 16px; color: #374151;">Bonjour <strong>${name}</strong>,</p>
          
          <p style="font-size: 16px; color: #374151;">
            Nous sommes heureux de vous informer que votre demande de partenariat a Ã©tÃ© <strong style="color: #059669;">approuvÃ©e</strong> !
          </p>

          <p style="font-size: 16px; color: #374151;">
            Votre compte <strong>${role}</strong> est maintenant actif. Voici vos identifiants de connexion :
          </p>

          <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0; border-radius: 6px;">
            <p style="margin: 0 0 12px 0; color: #374151;">
              <strong style="color: #1f2937;">ðŸ“§ Email (identifiant) :</strong><br>
              <span style="font-size: 18px; color: #2563eb; font-family: monospace;">${email}</span>
            </p>
            <p style="margin: 0; color: #374151;">
              <strong style="color: #1f2937;">ðŸ”‘ Mot de passe provisoire :</strong><br>
              <span style="font-size: 18px; color: #dc2626; font-family: monospace; background-color: #fee2e2; padding: 8px 12px; border-radius: 4px; display: inline-block;">${temporaryPassword}</span>
            </p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 6px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>âš ï¸ Important :</strong> Ce mot de passe est provisoire. Pour votre sÃ©curitÃ©, nous vous recommandons fortement de le changer lors de votre premiÃ¨re connexion.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.origin[0]}/login" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              ðŸš€ Se connecter maintenant
            </a>
          </div>

          <div style="border-top: 2px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
            <p style="font-size: 14px; color: #6b7280;">
              <strong>Prochaines Ã©tapes :</strong>
            </p>
            <ul style="color: #6b7280; font-size: 14px;">
              <li>Connectez-vous avec vos identifiants</li>
              <li>Changez votre mot de passe provisoire</li>
              <li>ComplÃ©tez votre profil professionnel</li>
              <li>Commencez Ã  utiliser RestauConnect</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
            Besoin d'aide ? Contactez-nous Ã  support@restauconnect.fr
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
            L'Ã©quipe RestauConnect<br>
            Â© ${new Date().getFullYear()} RestauConnect - Tous droits rÃ©servÃ©s
          </p>
        </div>
      </div>
    `
  })
};


// Send templated emails
export const sendWelcomeEmail = (to: string, name: string) => {
  const template = emailTemplates.welcome(name);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendNewMessageEmail = (to: string, senderName: string, message: string) => {
  const template = emailTemplates.newMessage(senderName, message);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendNewReviewEmail = (to: string, reviewerName: string, rating: number, comment: string) => {
  const template = emailTemplates.newReview(reviewerName, rating, comment);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendListingMatchEmail = (to: string, listingTitle: string, matchCount: number) => {
  const template = emailTemplates.listingMatch(listingTitle, matchCount);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendPasswordResetEmail = (to: string, resetToken: string) => {
  const template = emailTemplates.passwordReset(resetToken);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendEmailVerificationEmail = (to: string, verificationToken: string) => {
  const template = emailTemplates.emailVerification(verificationToken);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};

export const sendApprovalWithCredentialsEmail = (to: string, name: string, email: string, temporaryPassword: string, role: string) => {
  const template = emailTemplates.approvalWithCredentials(name, email, temporaryPassword, role);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html
  });
};
