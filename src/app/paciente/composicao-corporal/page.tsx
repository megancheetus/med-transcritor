import { redirect } from 'next/navigation';
import PatientPortalShell from '@/components/PatientPortalShell';
import { getAuthenticatedPatientFromCookies } from '@/lib/patientSession';
import {
  getBioimpedanceTimelineByPatientId,
  getLatestBioimpedanceByPatientId,
} from '@/lib/medicalRecordManager';

function formatNumber(value?: number, suffix?: string) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix || ''}`;
}

function BodyMetricTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[#cfe0e8] bg-white px-3 py-1.5 text-xs shadow-sm">
      <span className="text-[#4b6573]">{label}: </span>
      <span className="font-semibold text-[#155b79]">{value}</span>
    </div>
  );
}

function toPath(values: Array<number | undefined>, min: number, max: number, width: number, height: number): string {
  if (values.length < 2 || min === max) {
    return '';
  }

  const stepX = width / (values.length - 1);
  const points: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined) {
      continue;
    }

    const ratio = (value - min) / (max - min);
    const y = height - ratio * height;
    points.push(`${points.length === 0 ? 'M' : 'L'} ${index * stepX} ${y}`);
  }

  return points.join(' ');
}

function MiniTrendChart({
  title,
  unit,
  color,
  values,
  dates,
}: {
  title: string;
  unit: string;
  color: string;
  values: Array<number | undefined>;
  dates: string[];
}) {
  const validValues = values.filter((value): value is number => value !== undefined && Number.isFinite(value));

  if (validValues.length < 2) {
    return (
      <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-[#155b79]">{title}</h4>
          <span className="text-xs text-[#4b6573]">Dados insuficientes</span>
        </div>
        <p className="text-xs text-[#7b8d97]">Necessário ao menos 2 medições para exibir tendência.</p>
      </div>
    );
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const width = 360;
  const height = 140;
  const path = toPath(values, min, max, width, height);
  const lastValue = validValues[validValues.length - 1];

  return (
    <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-[#155b79]">{title}</h4>
        <span className="text-xs font-semibold" style={{ color }}>
          Atual: {formatNumber(lastValue, unit)}
        </span>
      </div>

      <svg className="w-full h-[150px]" viewBox={`0 0 ${width} ${height + 16}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((step) => {
          const y = (height / 4) * step;
          return <line key={step} x1="0" y1={y} x2={width} y2={y} stroke="#e6edf1" strokeWidth="1" />;
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-[#4b6573]">
        <span>Min: {formatNumber(min, unit)}</span>
        <span>Max: {formatNumber(max, unit)}</span>
      </div>

      <div className="mt-2 grid gap-2 text-[10px] text-[#6b7f8c]" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
        {dates.map((date, index) => (
          <span key={`${date}-${index}`} className="text-center truncate">
            {new Date(date).toLocaleDateString('pt-BR')}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function PacienteComposicaoCorporalPage() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const latest = await getLatestBioimpedanceByPatientId(patient.id);
  const timeline = await getBioimpedanceTimelineByPatientId(patient.id);

  const imcSeries = timeline.map((item) => item.imc);
  const pgcSeries = timeline.map((item) => item.pgc);
  const massaMagraSeries = timeline.map((item) => item.massaMagraKg);
  const massaGorduraSeries = timeline.map((item) => item.massaGorduraKg);
  const timelineDates = timeline.map((item) => item.recordDate);

  return (
    <PatientPortalShell
      title="Composição Corporal"
      subtitle="Painel inspirado em bioimpedância"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      {!latest?.bioimpedance ? (
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#155b79]">Sem dados de bioimpedância</h3>
          <p className="mt-2 text-sm text-[#4b6573]">
            Assim que um profissional registrar os dados de composição corporal no atendimento, eles aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {timeline.length > 1 && (
            <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#155b79]">Evolução temporal</h3>
                  <p className="text-sm text-[#4b6573]">Mini-gráficos com escala independente por métrica para leitura clínica mais precisa.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <MiniTrendChart title="IMC" unit="" color="#155b79" values={imcSeries} dates={timelineDates} />
                <MiniTrendChart title="PGC" unit="%" color="#0f766e" values={pgcSeries} dates={timelineDates} />
                <MiniTrendChart title="Massa magra" unit=" kg" color="#b45309" values={massaMagraSeries} dates={timelineDates} />
                <MiniTrendChart title="Massa de gordura" unit=" kg" color="#be123c" values={massaGorduraSeries} dates={timelineDates} />
              </div>
            </div>
          )}

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#155b79]">Última avaliação de composição corporal</h3>
                <p className="text-sm text-[#4b6573] mt-1">
                  Registro em {new Date(latest.recordDate).toLocaleDateString('pt-BR')} com {latest.profissional} ({latest.especialidade})
                </p>
              </div>
              <div className="rounded-lg bg-[#effaf7] px-3 py-2 text-sm text-[#0f766e] font-semibold">
                Score: {formatNumber(latest.bioimpedance.score)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
              <h4 className="text-base font-bold text-[#155b79] mb-4">Mapa corporal</h4>
              <div className="relative mx-auto h-[360px] sm:h-[420px] w-[220px] sm:w-[260px] rounded-2xl bg-gradient-to-b from-[#f6fbfd] to-[#ecf5f8] border border-[#d9e8ef]">
                <div className="absolute left-1/2 top-6 h-14 w-14 -translate-x-1/2 rounded-full border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>
                <div className="absolute left-1/2 top-24 h-32 w-20 -translate-x-1/2 rounded-3xl border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>
                <div className="absolute left-[22px] top-[116px] h-16 w-9 rounded-2xl border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>
                <div className="absolute right-[22px] top-[116px] h-16 w-9 rounded-2xl border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>
                <div className="absolute left-[86px] top-[248px] h-32 w-9 rounded-2xl border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>
                <div className="absolute right-[86px] top-[248px] h-32 w-9 rounded-2xl border-4 border-[#7ab6cb] bg-[#d9eef5]"></div>

                <div className="hidden sm:block absolute left-2 top-[92px] max-w-[100px]"><BodyMetricTag label="Braço E (magra)" value={formatNumber(latest.bioimpedance.segmentalLean?.leftArmKg, ' kg')} /></div>
                <div className="hidden sm:block absolute right-2 top-[92px] max-w-[100px]"><BodyMetricTag label="Braço D (magra)" value={formatNumber(latest.bioimpedance.segmentalLean?.rightArmKg, ' kg')} /></div>
                <div className="hidden sm:block absolute left-1/2 top-[196px] -translate-x-1/2 max-w-[120px]"><BodyMetricTag label="Tronco (magra)" value={formatNumber(latest.bioimpedance.segmentalLean?.trunkKg, ' kg')} /></div>
                <div className="hidden sm:block absolute left-2 bottom-10 max-w-[100px]"><BodyMetricTag label="Perna E (magra)" value={formatNumber(latest.bioimpedance.segmentalLean?.leftLegKg, ' kg')} /></div>
                <div className="hidden sm:block absolute right-2 bottom-10 max-w-[100px]"><BodyMetricTag label="Perna D (magra)" value={formatNumber(latest.bioimpedance.segmentalLean?.rightLegKg, ' kg')} /></div>
              </div>

              <div className="sm:hidden mt-4 grid grid-cols-2 gap-2">
                <BodyMetricTag label="Braço E" value={formatNumber(latest.bioimpedance.segmentalLean?.leftArmKg, ' kg')} />
                <BodyMetricTag label="Braço D" value={formatNumber(latest.bioimpedance.segmentalLean?.rightArmKg, ' kg')} />
                <BodyMetricTag label="Perna E" value={formatNumber(latest.bioimpedance.segmentalLean?.leftLegKg, ' kg')} />
                <BodyMetricTag label="Perna D" value={formatNumber(latest.bioimpedance.segmentalLean?.rightLegKg, ' kg')} />
                <div className="col-span-2">
                  <BodyMetricTag label="Tronco" value={formatNumber(latest.bioimpedance.segmentalLean?.trunkKg, ' kg')} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm grid grid-cols-2 gap-3">
                <div><p className="text-xs text-[#4b6573]">Peso</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.pesoKg, ' kg')}</p></div>
                <div><p className="text-xs text-[#4b6573]">IMC</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.imc)}</p></div>
                <div><p className="text-xs text-[#4b6573]">PGC</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.gorduraCorporalPercent, '%')}</p></div>
                <div><p className="text-xs text-[#4b6573]">Massa de gordura</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.massaGorduraKg, ' kg')}</p></div>
                <div><p className="text-xs text-[#4b6573]">Massa magra</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.massaMagraKg, ' kg')}</p></div>
                <div><p className="text-xs text-[#4b6573]">Músculo esquelético</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.musculoEsqueleticoKg, ' kg')}</p></div>
              </div>

              <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm grid grid-cols-2 gap-3">
                <div><p className="text-xs text-[#4b6573]">Agua corporal total</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.aguaCorporalTotalL, ' L')}</p></div>
                <div><p className="text-xs text-[#4b6573]">Gordura visceral</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.gorduraVisceralNivel)}</p></div>
                <div className="col-span-2"><p className="text-xs text-[#4b6573]">Taxa metabólica basal</p><p className="text-xl font-bold text-[#155b79]">{formatNumber(latest.bioimpedance.taxaMetabolicaBasalKcal, ' kcal')}</p></div>
              </div>

              {latest.bioimpedance.observacoes && (
                <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
                  <p className="text-xs text-[#4b6573] uppercase tracking-wide">Observações do profissional</p>
                  <p className="mt-2 text-sm text-[#0c161c]">{latest.bioimpedance.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PatientPortalShell>
  );
}
