import request from 'supertest';
import { app } from '../app';
import { PlatformConfig } from '../models/PlatformConfig';
import { PlatformConfigHistory } from '../models/PlatformConfigHistory';

describe('Platform config API (integration)', () => {
  const adminToken = 'test-token-super_admin-001';
  const key = 'integration_test_config_key';

  beforeAll(async () => {
    // Clean up any previous test artifacts
    await PlatformConfig.deleteMany({ key });
    await PlatformConfigHistory.deleteMany({ key });
  });

  afterAll(async () => {
    // Clean up test artifacts
    await PlatformConfig.deleteMany({ key });
    await PlatformConfigHistory.deleteMany({ key });
  });

  it('requires auth for PUT and writes history', async () => {
    // Ensure PUT without token fails
    const unauth = await request(app)
      .put(`/api/platform-config/${key}`)
      .send({ value: 42, description: 'unauthorized update' });
    expect(unauth.status).toBe(401);

    // Do the update with admin token

    const res = await request(app)
      .put(`/api/platform-config/${key}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 123, description: 'integration test' });

    if (res.status !== 200) {
      // Affiche le body de la réponse pour voir le détail de l'erreur
      // eslint-disable-next-line no-console
      console.error('Test erreur backend:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('key', key);
    expect(res.body.data).toHaveProperty('value', 123);

    // GET the config
    const getRes = await request(app).get(`/api/platform-config/${key}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('success', true);
    expect(getRes.body.data).toHaveProperty('value', 123);

    // History must contain at least one entry
    const historyRes = await request(app).get(`/api/platform-config/${key}/history`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body).toHaveProperty('success', true);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);

    const firstEntry = historyRes.body.data[0];
    expect(firstEntry).toHaveProperty('newValue', 123);
    // The test token maps to a role of 'super_admin'
    expect(firstEntry).toHaveProperty('performedByRole');
  });
});
// deduplicated duplicate test block (kept single suite above)
