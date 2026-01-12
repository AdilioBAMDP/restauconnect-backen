import request from 'supertest';
import { app } from '../app';

describe('Accès routes admin protégées', () => {
  it('refuse l’accès sans authentification', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('refuse l’accès à un user non admin', async () => {
    // Remplacer par un token valide d’un user non admin
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer test-token-18'); // id 18 = livreur dans vos comptes de test
    expect([401, 403]).toContain(res.status);
  });

  it('autorise l’accès à un super_admin', async () => {
    // Remplacer par un token valide d’un super_admin
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer test-token-super_admin-001');
    expect(res.status).toBe(200);
  });
});
