import type { NightDigest } from '../digest/types.js';

const dash = '—';

export function DigestPage({ digest }: { digest: NightDigest }) {
  if (digest.rows.length === 0) {
    return <p>nothing ran</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>job</th>
          <th>owner</th>
          <th>runs</th>
          <th>retries</th>
          <th>last status</th>
          <th>last error</th>
          <th>first</th>
          <th>last</th>
        </tr>
      </thead>
      <tbody>
        {digest.rows.map((row) => (
          <tr class={row.retries >= 3 || row.lastStatus === 'fail' ? 'warn' : undefined}>
            <td>{row.job}</td>
            <td>{row.owner ?? dash}</td>
            <td>{row.runs}</td>
            <td>{row.retries}</td>
            <td>{row.lastStatus}</td>
            <td>{row.lastError ?? dash}</td>
            <td>{row.firstAt}</td>
            <td>{row.lastAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
