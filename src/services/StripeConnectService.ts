import { logger } from '../utils/logger';

class StripeConnectService {
  async createAccount(userId: string) {
    logger.info('Creating Stripe Connect account', { userId });
    return { id: 'acct_mock', object: 'account' };
  }

  async createAccountLink(accountId: string, userId: string) {
    logger.info('Creating Stripe account link', { accountId, userId });
    return { url: 'https://connect.stripe.com/mock', object: 'account_link' };
  }
}

module.exports = new StripeConnectService();
export default new StripeConnectService();

