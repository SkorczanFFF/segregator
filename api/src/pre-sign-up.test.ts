import assert from 'node:assert/strict'
import { test } from 'node:test'
import { signUpAllowed } from './pre-sign-up.ts'

test('lets anyone sign up while the list is *', () => {
  assert.equal(signUpAllowed('anyone@example.com', '*'), true)
})

test('lets in only listed addresses once the list is set', () => {
  const list = 'Ania@Example.com, jan@example.com'
  assert.equal(signUpAllowed('ania@example.com', list), true)
  assert.equal(signUpAllowed('JAN@example.com', list), true)
  assert.equal(signUpAllowed('someone@example.com', list), false)
  assert.equal(signUpAllowed('', 'jan@example.com,'), false)
})
