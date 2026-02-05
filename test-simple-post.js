// Test très simple POST product
const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTZhZGYxYWZmNzZiY2RlN2ViZmNhY2MiLCJlbWFpbCI6ImFydGlzYW4uYXVkaXRAdGVzdC5mciIsInJvbGUiOiJhcnRpc2FuIiwiaWF0IjoxNzY4NjEyMTcxLCJleHAiOjE3Njg2OTg1NzF9.VN3ugyM3ydTXRmD_yRVzEgK2pownO5Mm5D79PzgATm4';

const data = JSON.stringify({
  name: 'Produit Test Simple',
  description: 'Test',
  category: 'autre',
  price: 10,
  unit: 'piece',
  inStock: true,
  stockQuantity: 1
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/products',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
