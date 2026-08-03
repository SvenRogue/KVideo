import assert from 'node:assert/strict';
import test from 'node:test';

import { isBlockedTargetUrl } from '@/lib/server/network-guard';

test('blocks private and reserved targets', () => {
  assert.equal(isBlockedTargetUrl('http://127.0.0.1:8080/'), true);
  assert.equal(isBlockedTargetUrl('https://10.0.0.5/x'), true);
  assert.equal(isBlockedTargetUrl('http://192.168.1.1/'), true);
  assert.equal(isBlockedTargetUrl('http://169.254.169.254/latest/meta-data'), true);
  assert.equal(isBlockedTargetUrl('http://172.16.0.1/'), true);
  assert.equal(isBlockedTargetUrl('http://100.64.0.1/'), true);
  assert.equal(isBlockedTargetUrl('http://localhost/'), true);
  assert.equal(isBlockedTargetUrl('http://router.local/'), true);
  assert.equal(isBlockedTargetUrl('http://[::1]/'), true);
  assert.equal(isBlockedTargetUrl('http://[fc00::1]/'), true);
});

test('allows public targets and rejects non-http schemes', () => {
  assert.equal(isBlockedTargetUrl('https://example.com/'), false);
  assert.equal(isBlockedTargetUrl('http://example.com/x.m3u8'), false);
  assert.equal(isBlockedTargetUrl('https://8.8.8.8/'), false);
  assert.equal(isBlockedTargetUrl('ftp://example.com/'), true);
  assert.equal(isBlockedTargetUrl('file:///etc/passwd'), true);
  assert.equal(isBlockedTargetUrl('not a url'), true);
});
