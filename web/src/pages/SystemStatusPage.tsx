import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type SystemStatus } from '../api';
import { ErrorBanner } from '../components/ui';

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`;
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const duration = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};

type Level = 'ok' | 'warn' | 'bad' | 'info';
const MARK: Record<Level, string> = { ok: '✔', warn: '!', bad: '✖', info: '•' };
const COLOR: Record<Level, string> = { ok: '#15803d', warn: '#b45309', bad: '#b91c1c', info: '#475569' };

/** One measured fact. The mark is text, not just colour, so it reads in print and for colour-blind staff. */
function Row({ level, label, children }: { level: Level; label: string; children: ReactNode }) {
  return (
    <tr>
      <td style={{ color: COLOR[level], fontWeight: 700, verticalAlign: 'top', padding: '0.2rem 0' }} aria-label={level}>{MARK[level]}</td>
      <th scope="row" style={{ textAlign: 'left', fontWeight: 600, paddingRight: '1rem', verticalAlign: 'top', padding: '0.2rem 1rem 0.2rem 0' }}>{label}</th>
      <td style={{ verticalAlign: 'top', padding: '0.2rem 0', overflowWrap: 'anywhere' }}>{children}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {/* Fixed columns, so every section lines up the same way. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '1.6rem' }} /><col style={{ width: '10.5rem' }} /><col /></colgroup>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

const DISK_TEXT: Record<SystemStatus['backupDisk'], [Level, string]> = {
  'same-drive': ['bad', 'Same drive as the database: a disk failure loses both.'],
  'same-physical-disk': ['bad', 'Another drive letter, but the same physical disk as the database: a disk failure loses both.'],
  'separate-disk': ['ok', 'A separate physical disk.'],
  network: ['ok', 'A network folder.'],
  unknown: ['warn', 'Could not tell whether this is a separate physical disk.'],
};

/**
 * For whoever looks after the clinic computer: is the server healthy, are backups real and
 * recent, has a restore actually been proven. Every line comes from a check the server ran just
 * now (GET /api/system/status). It never shows patient records.
 */
export function SystemStatusPage() {
  const [st, setSt] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return api<SystemStatus>('GET', '/api/system/status').then(setSt, setError);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function testRestore() {
    setTesting(true);
    setTestMsg(null);
    setError(null);
    try {
      const r = await api<{ restoreVerify: { patients: number; integrity: string } }>('POST', '/api/backups/self-test');
      setTestMsg(`Restore test passed: a new backup was taken, restored to a separate copy and checked (${r.restoreVerify.patients} patients, integrity ${r.restoreVerify.integrity}). The live records were not touched.`);
    } catch (e) {
      setError(e);
    } finally {
      setTesting(false);
      void load();
    }
  }

  const b = st?.backup;
  return (
    <div className="page narrow">
      <p className="no-print"><Link to="/settings">← Clinic details</Link></p>
      <h1>System status</h1>
      <p className="muted">
        Checked on this computer when the page was opened. No patient records are shown here.
        {st && <> Last checked {when(st.checkedAt)}.</>}
      </p>
      <div className="row wrap no-print" style={{ gap: '0.6rem', marginBottom: '1rem' }}>
        <button className="btn" onClick={() => void load()} disabled={testing}>Check again</button>
        <button className="btn primary" onClick={() => void testRestore()} disabled={testing || !b?.configured}>
          {testing ? 'Testing restore…' : 'Test restore now'}
        </button>
      </div>
      <ErrorBanner error={error} />
      {testMsg && <div className="banner ok" role="status" style={{ marginBottom: '1rem' }}>{testMsg}</div>}
      {!st && !error && <p className="muted">Checking…</p>}

      {st && (
        <>
          {st.warnings.length > 0 ? (
            <div className="banner warn" role="alert" style={{ marginBottom: '1rem' }}>
              <strong>Needs attention ({st.warnings.length})</strong>
              <ul style={{ margin: '0.4rem 0 0' }}>{st.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          ) : (
            <div className="banner ok" role="status" style={{ marginBottom: '1rem' }}>Every check below passed.</div>
          )}

          <Section title="Server">
            <Row level="ok" label="Running">version {st.version}, for {duration(st.uptimeSeconds)} (since {when(st.serverStartedAt)})</Row>
            <Row level="info" label="Computer started">{when(st.machineBootedAt)}</Row>
            <Row
              level={st.restarts.crashesLast24Hours >= 3 ? 'bad' : st.restarts.crashesLast7Days > 0 ? 'warn' : st.restarts.logFound ? 'ok' : 'info'}
              label="Unexpected stops"
            >
              {!st.restarts.logFound
                ? 'No supervisor log here (the app was not started by the automatic-start task).'
                : st.restarts.crashesLast7Days === 0
                  ? 'None in the last 7 days.'
                  : `${st.restarts.crashesLast7Days} in the last 7 days (${st.restarts.crashesLast24Hours} in the last 24 hours); last ${when(st.restarts.lastCrash!.at)}, exit code ${st.restarts.lastCrash!.exitCode}. Each was restarted automatically.`}
            </Row>
            <Row level="info" label="Clock">{when(new Date().toISOString())} on this device; clinic time zone {st.timezone}</Row>
          </Section>

          <Section title="Data">
            <Row level={st.database.integrity === 'ok' ? 'ok' : 'bad'} label="Database">integrity check: {st.database.integrity}</Row>
            <Row level={st.dataDirSource === 'legacy-fallback' ? 'warn' : 'ok'} label="Data folder"><code>{st.dataDir}</code></Row>
            {st.disks.data && (
              <Row level={st.warnings.some((w) => w.startsWith('The disk holding the database')) ? 'bad' : 'ok'} label="Free space">
                {gb(st.disks.data.freeBytes)} free of {gb(st.disks.data.totalBytes)}
              </Row>
            )}
          </Section>

          {b && (
            <Section title="Backups">
              <Row level={b.configured ? 'ok' : 'bad'} label="Encryption">{b.configured ? 'On (backups are encrypted with the clinic passphrase).' : 'OFF: no backup passphrase is set, so no automatic backups are taken.'}</Row>
              <Row level={b.lastSuccess && b.healthy ? 'ok' : 'bad'} label="Last verified backup">
                {b.lastSuccess ? `${when(b.lastSuccess.at)} (${ago(b.lastSuccess.at)}); one is taken every ${b.intervalHours} h, newest ${b.keep} kept` : 'None yet.'}
              </Row>
              {b.lastFailure && <Row level="bad" label="Last failure">{when(b.lastFailure.at)}: {b.lastFailure.error}</Row>}
              <Row level={DISK_TEXT[st.backupDisk][0]} label="Backup folder">
                <code>{b.dir}</code>
                <div className="muted">{DISK_TEXT[st.backupDisk][1]}</div>
                {st.disks.backup && <div className="muted">{gb(st.disks.backup.freeBytes)} free</div>}
              </Row>
              <Row level={st.restoreTest.lastFailure ? 'bad' : st.restoreTest.overdue ? 'warn' : 'ok'} label="Restore test">
                {st.restoreTest.lastFailure
                  ? `FAILED ${when(st.restoreTest.lastFailure.at)}: ${st.restoreTest.lastFailure.error}`
                  : st.restoreTest.lastSuccess
                    ? `Passed ${when(st.restoreTest.lastSuccess.at)} (${ago(st.restoreTest.lastSuccess.at)})${st.restoreTest.lastSuccess.patients != null ? `, ${st.restoreTest.lastSuccess.patients} patients` : ''}. Due every ${st.restoreTest.dueDays} days.`
                    : `Never run. Due every ${st.restoreTest.dueDays} days.`}
              </Row>
            </Section>
          )}

          <Section title="Network">
            <Row level={st.host === '127.0.0.1' || st.host === 'localhost' ? 'info' : st.https ? 'ok' : 'bad'} label="Who can connect">
              {st.host === '127.0.0.1' || st.host === 'localhost' ? 'This computer only.' : `Other devices on the network (port ${st.port}).`}
            </Row>
            <Row level={st.https ? (st.certificateDaysLeft != null && st.certificateDaysLeft <= 14 ? 'warn' : 'ok') : 'info'} label="HTTPS">
              {st.https ? `On; the certificate expires in ${st.certificateDaysLeft} days.` : 'Off.'} <Link to="/settings/connect">Connect a staff device</Link>
            </Row>
          </Section>
        </>
      )}
    </div>
  );
}
