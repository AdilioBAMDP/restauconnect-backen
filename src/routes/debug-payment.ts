import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/payments/debug-payment-data
 * Endpoint de debug pour voir exactement ce que le frontend envoie
 */
router.post('/debug-payment-data', authenticateToken, async (req: express.Request, res: express.Response): Promise<any> => {
  try {
    const userId = (req as any).user.id;
    
    console.log('\nÃ°Å¸â€Â DEBUG PAYMENT DATA FROM FRONTEND:\n');
    console.log('User ID:', userId);
    console.log('Body reÃƒÂ§u:', JSON.stringify(req.body, null, 2));
    console.log('\n--- DÃƒÂ©tails ---');
    console.log('amount:', req.body.amount, typeof req.body.amount);
    console.log('currency:', req.body.currency);
    console.log('orderData:', JSON.stringify(req.body.orderData, null, 2));
    console.log('orderData.items:', req.body.orderData?.items);
    console.log('orderData.supplierId:', req.body.orderData?.supplierId);
    console.log('orderData.deliveryAddress:', req.body.orderData?.deliveryAddress);
    console.log('orderData.deliveryDate:', req.body.orderData?.deliveryDate);
    console.log('orderData.deliveryTime:', req.body.orderData?.deliveryTime);
    console.log('orderData.subtotal:', req.body.orderData?.subtotal);
    console.log('orderData.total:', req.body.orderData?.total);
    
    return res.json({
      success: true,
      message: 'DonnÃƒÂ©es reÃƒÂ§ues et loggÃƒÂ©es. Regardez les logs Railway.',
      receivedData: req.body
    });
    
  } catch (error: any) {
    logger.error('Erreur debug:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
