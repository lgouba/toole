import { BarChart } from '../components/BarChart';
import { Granularity, ReportBucket, periodLabel, fmtFcfa } from './fleetTypes';

/** Deux graphes (courses + total généré) à partir d'une série de buckets. */
export function ReportCharts({
  series,
  granularity,
}: {
  series: ReportBucket[];
  granularity: Granularity;
}) {
  if (series.length === 0) {
    return <div className="empty">Aucune donnée sur la période.</div>;
  }
  const labels = series.map((b) => periodLabel(b.period, granularity));
  return (
    <div className="grid-2">
      <div>
        <div className="label">Courses livrées</div>
        <BarChart
          data={series.map((b, i) => ({ label: labels[i], value: b.courses }))}
          height={200}
          color="#1d9e75"
        />
      </div>
      <div>
        <div className="label">Total généré</div>
        <BarChart
          data={series.map((b, i) => ({ label: labels[i], value: b.totalGenere }))}
          height={200}
          color="#12b58a"
          valueFormatter={fmtFcfa}
        />
      </div>
    </div>
  );
}

/** Barre de contrôle granularité (Jour/Mois/Année) + plage de dates. */
export function ReportControls({
  granularity,
  from,
  to,
  onGranularity,
  onFrom,
  onTo,
}: {
  granularity: Granularity;
  from: string;
  to: string;
  onGranularity: (g: Granularity) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['day', 'month', 'year'] as Granularity[]).map((g) => (
          <button
            key={g}
            className={`btn ${granularity === g ? '' : 'btn-ghost'} btn-sm`}
            onClick={() => onGranularity(g)}
          >
            {g === 'day' ? 'Jour' : g === 'month' ? 'Mois' : 'Année'}
          </button>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        Du
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        au
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </label>
    </div>
  );
}
