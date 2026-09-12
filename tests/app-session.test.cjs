/* eslint-disable @typescript-eslint/no-require-imports -- Node regression tests run as CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, globals = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', ...Object.keys(globals), js)(exports, ...Object.values(globals));
  return exports;
}
const api = load('src/lib/app-session.ts');
const device = { p_device_key: 'test-device', p_device_label: 'Test', p_user_agent: 'node' };
const userClaim = { employeeNumber: 'QA-42', accessProfile: 'mechanic', assignedBase: 'Base teste', isAdmin: false };
function mockClient(options = {}) {
  const calls = [];
  let session = { user: { id: 'old-admin-session' } };
  let identity = { employeeNumber: '0001', accessProfile: 'admin', isAdmin: true };
  return {
    calls,
    get identity() { return identity; },
    get session() { return session; },
    auth: {
      async getSession() { calls.push('getSession'); return { data: { session } }; },
      async signOut({scope}) { calls.push(`signOut:${scope}`); session = null; return { error: null }; },
      async signInAnonymously() { calls.push('anonymous'); session = { user: {id: 'new-session'} }; return { data: session, error: null }; },
      async getUser() { calls.push('getUser'); return { data: { user: options.switchedSession ? {id:'other-tab'} : session?.user }, error: null }; },
    },
    async rpc(name, args) {
      calls.push(name);
      if(name === 'disconnect_my_device') { identity = null; return {data:true,error:null}; }
      if(name === 'claim_device_identity') {
        assert.equal(args.p_employee_number, 'QA-42');
        assert.equal(args.p_password, 'custom-password');
        if(options.wrongPassword) return {data:null,error:{message:'wrong'}};
        identity = options.wrongClaim || userClaim;
        return {data:identity,error:null};
      }
      if(name === 'begin_presentation_demo') {
        identity = { ...userClaim, employeeNumber:'demo-42', accessProfile:args.p_profile, isPresentationDemo:true };
        return {data:identity,error:null};
      }
      if(name === 'activate_current_device') return {data:null,error:options.activationFailure ? {message:'failed'} : null};
      if(name === 'refresh_current_device') return {data:options.refreshClaim || identity,error:null};
      throw Error(`Unexpected RPC ${name}`);
    }
  };
}
const credentials = {kind:'credentials',login:' QA-42 ',password:'custom-password'};
test('explicit credentials discard the former admin and return only the supplied user', async () => {
  const client = mockClient();
  const result = await api.signInApplication(client, credentials, device);
  assert.equal(result.employeeNumber, 'QA-42');
  assert.equal(result.accessProfile, 'mechanic');
  assert.ok(client.calls.indexOf('disconnect_my_device') < client.calls.indexOf('claim_device_identity'));
  assert.ok(client.calls.indexOf('signOut:local') < client.calls.indexOf('anonymous'));
});
test('wrong password cannot fall back to stored administrator or leave a claimed session', async () => {
  const client = mockClient({wrongPassword:true});
  await assert.rejects(api.signInApplication(client, credentials, device), /senha inválida/);
  assert.equal(client.session,null);
  assert.equal(client.identity,null);
  assert.equal(client.calls.includes('activate_current_device'),false);
});
test('mismatched claim or refresh and changed browser session are rejected', async () => {
  for(const options of [
    {wrongClaim:{employeeNumber:'0001',accessProfile:'admin'}},
    {refreshClaim:{employeeNumber:'0001',accessProfile:'admin'}},
    {switchedSession:true},
    {activationFailure:true},
  ]) {
    const client = mockClient(options);
    await assert.rejects(api.signInApplication(client, credentials, device));
    assert.equal(client.session,null);
  }
});
test('stored identity is only restored when the server confirms the same employee', async () => {
  const client = mockClient();
  await assert.rejects(api.restoreApplicationSession(client,'QA-42',device), /sessão mudou/);
  assert.equal(client.calls.includes('activate_current_device'),false);
  assert.equal((await api.restoreApplicationSession(mockClient(),'0001',device)).employeeNumber,'0001');
});
test('demo enters the chosen actual role and rejects any elevated or mismatched claim', async () => {
  for(const profile of ['maintenance_leader','mechanic','commander','coordination','toolroom']) {
    const identity = await api.signInApplication(mockClient(),{kind:'demo',profile},device);
    assert.equal(identity.accessProfile,profile);
    assert.equal(identity.isPresentationDemo,true);
  }
  for(const claim of [null,{...userClaim,accessProfile:'admin',isAdmin:true},{...userClaim,isPresentationDemo:false},{...userClaim,employeeNumber:'0001',isPresentationDemo:true}]) {
    assert.throws(()=>api.verifiedApplicationIdentity(claim,{profile:'mechanic',demo:true}));
  }
});
test('identity reset clears preview as well as account without deleting operational records', () => {
  const values = new Map([['passagem-de-pista-user','0001'],['flight-ia-presentation-user','old-preview'],['flight-ia-presentation-fleets','["S92"]'],['passagem-de-pista-flights','records']]);
  api.clearStoredApplicationIdentity({removeItem:key=>values.delete(key)});
  assert.deepEqual([...values],[['passagem-de-pista-flights','records']]);
});
function pendingFixture() {
  const storage = new Map(); let now=1000;
  const sessionStorage = {setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)??null,removeItem:key=>storage.delete(key)};
  const globals = {sessionStorage, Date:{now:()=>now}};
  return {api:load('src/lib/presentation-login.ts',globals),storage,reload:()=>load('src/lib/presentation-login.ts',globals),advance:()=>{now+=60001;}};
}
test('pending credentials have precedence and are consumed only once, without storing passwords', () => {
  const {api,storage}=pendingFixture();
  api.preparePresentationLogin(' QA-42 ','secret');
  assert.equal(api.hasPendingPresentationLogin(),true);
  assert.equal([...storage.values()].includes('secret'),false);
  assert.deepEqual(api.consumePresentationLogin(),{kind:'credentials',login:'QA-42',password:'secret'});
  assert.equal(api.consumePresentationLogin(),null);
  assert.equal(api.hasPendingPresentationLogin(),false);
});
test('expired or reloaded handoff requires fresh login instead of restoring administrator', () => {
  const f=pendingFixture(); f.api.preparePresentationLogin('QA-42','secret'); f.advance();
  assert.equal(f.api.hasPendingPresentationLogin(),true);
  assert.deepEqual(f.api.consumePresentationLogin(),{kind:'account',expired:true});
  f.api.preparePresentationDemo('toolroom');
  assert.deepEqual(f.reload().consumePresentationLogin(),{kind:'account',expired:true});
});
test('explicit account login and latest demo selection replace earlier intent', () => {
  const {api}=pendingFixture();
  api.preparePresentationDemo('commander');api.preparePresentationAccountLogin();
  assert.deepEqual(api.consumePresentationLogin(),{kind:'account'});
  api.preparePresentationDemo('maintenance_leader');api.preparePresentationDemo('mechanic');
  assert.deepEqual(api.consumePresentationLogin(),{kind:'demo',profile:'mechanic'});
});
