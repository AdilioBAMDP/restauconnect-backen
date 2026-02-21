import request from 'supertest';
import { app } from '../app';

describe('AccÃƒÂ¨s routes admin protÃƒÂ©gÃƒÂ©es', () => {
  it('refuse lÃ¢â‚¬â„¢accÃƒÂ¨s sans authentification', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('refuse lÃ¢â‚¬â„¢accÃƒÂ¨s ÃƒÂ  un user non admin', async () => {
    // Remplacer par un token valide dÃ¢â‚¬â„¢un user non admin
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer test-token-18'); // id 18 = livreur dans vos comptes de test
    expect([401, 403]).toContain(res.status);
  });

  it('autorise lÃ¢â‚¬â„¢accÃƒÂ¨s ÃƒÂ  un super_admin', async () => {
    // Remplacer par un token valide dÃ¢â‚¬â„¢un super_admin
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer test-token-super_admin-001');
    expect(res.status).toBe(200);
  });
});
