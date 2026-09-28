import { useMemo, useState } from "react";
import { canonicalStorage } from "./data";
import {
  addTrainingItem,
  appendMenuEntry,
  archiveMenuEntry,
  createCanonicalSession,
  createInitialCanonicalCandidate,
  cutoverCanonical,
  deleteTrainingItemSettingChange,
  localDate,
  prepareCanonicalBackupRestore,
  prepareCanonicalCutover,
  recoverCanonical,
  updateTrainingItem,
  weekStart,
  exerciseHistory,
  applyMenuProposal,
  applyManMasterBootstrap,
  bodyRegionDerivedLoad,
  bodyRegionFrequency,
  createTrainerHistory,
  exerciseActuals,
  exerciseFrequency,
  exerciseOptions,
  overallDerivedLoad,
  MAN_MASTER_BOOTSTRAP_PACKAGE,
  validateMenuProposal,
} from "./canonical";
import type { AnalysisPeriod, AnalysisSeries, ManMasterBootstrapMapping } from "./canonical";
import type {
  CanonicalAppData,
  Exercise,
  Menu,
  MenuEntry,
  RecommendedDay,
  Session,
  TrainingItem,
} from "./canonical";
import { validateCanonical } from "./canonical";

type Page =
  | "top"
  | "run"
  | "extra"
  | "settings"
  | "history"
  | "analysis"
  | "masterBootstrap"
  | "menuImport"
  | "trainerHistoryExport";
type SettingsTab =
  | "profile"
  | "exercise"
  | "item"
  | "menu"
  | "settingHistory";
const days = ["月", "火", "水", "木", "金", "土", "日"];
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = <T,>(value: T): T => structuredClone(value);
const active = <T extends { lifecycle: string }>(rows: T[]) =>
  rows.filter((value) => value.lifecycle === "active");
const dayOf = (date: string) =>
  ((new Date(`${date}T00:00:00`).getDay() + 6) % 7) as RecommendedDay;
const entryLabel = (entry: MenuEntry, item: TrainingItem, exercise: Exercise) =>
  `${item.displayName || exercise.name}${entry.recommendedDay === undefined ? "（任意）" : `（推奨：${days[entry.recommendedDay]}）`}`;
const sessionDetail = (session: Session) =>
  `${session.snapshot.measureType === "reps" ? `${session.weight ?? 0} kg × ${session.reps ?? 0} 回` : `${session.seconds ?? 0} 秒`} × ${session.sets} セット${session.seat ? `　シート: ${session.seat}` : ""}`;

function Header({
  title,
  back,
  onSettings,
  onTop,
}: {
  title: string;
  back?: () => void;
  onSettings?: () => void;
  onTop: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="app-header">
      <button
        className={`header-back ${back ? "" : "header-blank"}`}
        disabled={!back}
        onClick={back}
      >
        ‹ 戻る
      </button>
      <h1>{title}</h1>
      <div className="header-menu">
        <button
          className="header-menu-button"
          aria-label="共通メニュー"
          onClick={() => setOpen((value) => !value)}
        >
          ≡
        </button>
        {open && (
          <div className="header-menu-panel">
            <button
              onClick={() => {
                setOpen(false);
                onTop();
              }}
            >
              実施メニュー
            </button>
            {onSettings && (
              <button
                onClick={() => {
                  setOpen(false);
                  onSettings();
                }}
              >
                設定
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
function Frame({
  title,
  children,
  back,
  onSettings,
  onTop,
}: {
  title: string;
  children: React.ReactNode;
  back?: () => void;
  onSettings?: () => void;
  onTop: () => void;
}) {
  return (
    <main className="app">
      <Header title={title} back={back} onSettings={onSettings} onTop={onTop} />
      {children}
    </main>
  );
}

export function CanonicalApp({ initial }: { initial: CanonicalAppData }) {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState<Page>("top");
  const [runEntryId, setRunEntryId] = useState<string>();
  const [extraItemId, setExtraItemId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");
  const [menuToInspectId, setMenuToInspectId] = useState<string>();
  const commit = async (next: CanonicalAppData) => {
    const checked = validateCanonical(next);
    if (checked.errors.length) {
      setNotice(
        `保存できません: ${checked.errors.map((value) => `${value.path} ${value.message}`).join(" / ")}`,
      );
      return false;
    }
    try {
      await canonicalStorage.writeCanonical(next);
      setData(next);
      setNotice("保存しました。");
      return true;
    } catch (error) {
      setNotice(`保存に失敗しました: ${String(error)}`);
      return false;
    }
  };
  const toTop = () => {
    setPage("top");
    setRunEntryId(undefined);
    setExtraItemId(undefined);
  };
  const exerciseFor = (item: TrainingItem) =>
    data.exercises.find((value) => value.id === item.exerciseId);
  const activeMenu = data.menus.find(
    (value) => value.id === data.activeMenuId && value.lifecycle === "active",
  );
  const finish = async (session: ReturnType<typeof createCanonicalSession>) => {
    if (await commit({ ...data, sessions: [...data.sessions, session] }))
      toTop();
  };
  const openSettings = (tab: SettingsTab = "profile", menuId?: string) => {
    setSettingsTab(tab);
    if (menuId !== undefined) setMenuToInspectId(menuId);
    setPage("settings");
  };
  const header = { onSettings: () => openSettings(), onTop: toTop };
  if (page === "run" && runEntryId) {
    const entry = data.menuEntries.find((value) => value.id === runEntryId);
    const item =
      entry &&
      data.trainingItems.find((value) => value.id === entry.trainingItemId);
    const exercise = item && exerciseFor(item);
    if (entry && item && exercise)
      return (
        <RunPage
          data={data}
          entry={entry}
          item={item}
          exercise={exercise}
          onBack={toTop}
          onComplete={finish}
          {...header}
        />
      );
    return (
      <Frame title="実行できません" back={toTop} {...header}>
        <p>実施項目または種目を解決できません。</p>
      </Frame>
    );
  }
  if (page === "extra" && extraItemId) {
    const item = data.trainingItems.find((value) => value.id === extraItemId);
    const exercise = item && exerciseFor(item);
    if (item && exercise)
      return (
        <RunPage
          data={data}
          item={item}
          exercise={exercise}
          onBack={() => setExtraItemId(undefined)}
          onComplete={finish}
          {...header}
        />
      );
  }
  if (page === "extra")
    return (
      <ExtraPage
        data={data}
        onBack={toTop}
        onChoose={setExtraItemId}
        {...header}
      />
    );
  if (page === "history")
    return <HistoryPage data={data} onBack={toTop} {...header} />;
  if (page === "analysis")
    return <AnalysisPage data={data} onBack={() => openSettings()} {...header} />;
  if (page === "masterBootstrap")
    return (
      <MasterBootstrapPage
        data={data}
        onBack={() => openSettings("exercise")}
        onApplied={(next) => {
          setData(next);
          setNotice("MAN用マスターを投入しました。");
        }}
        {...header}
      />
    );
  if (page === "menuImport")
    return (
      <MenuImportPage
        data={data}
        onBack={() => openSettings("menu")}
        onApplied={(next) => {
          setData(next);
          setNotice("メニューを投入しました。");
        }}
        onInspectMenu={(menuId) => openSettings("menu", menuId)}
        {...header}
      />
    );
  if (page === "trainerHistoryExport")
    return (
      <TrainerHistoryExportPage data={data} onBack={() => openSettings("settingHistory")} {...header} />
    );
  if (page === "settings")
    return (
      <SettingsPage
        data={data}
        commit={commit}
        tab={settingsTab}
        onTab={setSettingsTab}
        menuToInspectId={menuToInspectId}
        onMenuImport={() => setPage("menuImport")}
        onTrainerHistoryExport={() => setPage("trainerHistoryExport")}
        onAnalysis={() => setPage("analysis")}
        onMasterBootstrap={() => setPage("masterBootstrap")}
        onBack={toTop}
        {...header}
      />
    );
  const entries = activeMenu
    ? data.menuEntries
        .filter(
          (value) =>
            value.menuId === activeMenu.id && value.lifecycle === "active",
        )
        .sort((a, b) => a.order - b.order)
    : [];
  return (
    <TopPage
      data={data}
      activeMenu={activeMenu}
      entries={entries}
      notice={notice}
      commit={commit}
      onRun={(id) => {
        setRunEntryId(id);
        setPage("run");
      }}
      onExtra={() => setPage("extra")}
      onHistory={() => setPage("history")}
      {...header}
    />
  );
}

function TopPage({
  data,
  activeMenu,
  entries,
  notice,
  commit,
  onRun,
  onExtra,
  onHistory,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  activeMenu?: Menu;
  entries: MenuEntry[];
  notice: string;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  onRun: (id: string) => void;
  onExtra: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const today = localDate();
  const currentDay = dayOf(today);
  const start = weekStart(today, data.weekStartsOn);
  const [selectedDays, setSelectedDays] = useState<RecommendedDay[]>([
    currentDay,
  ]);
  const latestByEntry = new Map<string, Session>();
  data.sessions
    .filter((value) => value.date >= start && value.menuEntryId)
    .forEach((value) => latestByEntry.set(value.menuEntryId!, value));
  const toggleDay = (day: RecommendedDay) =>
    setSelectedDays((previous) =>
      previous.includes(day)
        ? previous.filter((value) => value !== day)
        : [...previous, day],
    );
  const visible = entries.filter(
    (entry) =>
      entry.recommendedDay !== undefined &&
      selectedDays.includes(entry.recommendedDay),
  );
  return (
    <Frame title="今週の実施メニュー" onSettings={onSettings} onTop={onTop}>
      {notice && <p className="week">{notice}</p>}
      <label>
        週メニュー
        <select
          value={activeMenu?.id ?? ""}
          onChange={async (event) =>
            await commit({
              ...data,
              activeMenuId: event.target.value || undefined,
            })
          }
        >
          <option value="">選択してください</option>
          {active(data.menus).map((menu) => (
            <option key={menu.id} value={menu.id}>
              {menu.name}
            </option>
          ))}
        </select>
      </label>
      {!activeMenu && (
        <section className="card">
          <p>有効な週メニューがありません。</p>
          <button className="primary" onClick={onSettings}>
            設定を開く
          </button>
        </section>
      )}
      {activeMenu && (
        <>
          <p className="week">
            {activeMenu.memo ||
              "推奨曜日は目安です。予定外の実施も記録できます。"}
          </p>
          <h2>推奨曜日の実施項目</h2>
          <div className="day-picker" aria-label="表示する推奨曜日">
            {days.map((label, index) => (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(index as RecommendedDay)}
                  onChange={() => toggleDay(index as RecommendedDay)}
                />
                {label}
              </label>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="week">選択した推奨曜日の項目はありません。</p>
          ) : (
            visible.map((entry) => {
              const item = data.trainingItems.find(
                (value) => value.id === entry.trainingItemId,
              );
              const exercise =
                item &&
                data.exercises.find((value) => value.id === item.exerciseId);
              if (!item || !exercise || item.lifecycle !== "active")
                return null;
              const session = latestByEntry.get(entry.id);
              return (
                <button
                  className="row item item-density"
                  key={entry.id}
                  onClick={() => onRun(entry.id)}
                >
                  <span>
                    <b>{item.displayName || exercise.name}</b>
                    <span className="item-detail-line">
                      <small>{`${exercise.classifications?.map((value) => value.label).join("・") || "未分類"}　${entry.recommendedDay === undefined ? "推奨：任意" : `推奨：${days[entry.recommendedDay]}`}`}</small>
                      <small className="item-history">{exerciseHistory(data.sessions, exercise.id)}</small>
                    </span>
                    <small>
                      {session
                        ? `今週実施済み　${sessionDetail(session)}`
                        : `${exercise.measureType === "reps" ? `${item.weight ?? 0} kg × ${item.reps ?? 0} 回` : `${item.seconds ?? 0} 秒`} × ${item.sets} セット`}
                    </small>
                  </span>
                  <span>{session ? "✓" : "›"}</span>
                </button>
              );
            })
          )}
        </>
      )}
      <button className="primary" onClick={onExtra}>
        ＋ 追加トレーニング
      </button>
      <button className="save-setting" onClick={onHistory}>
        実施履歴を見る
      </button>
    </Frame>
  );
}

function RunPage({
  data,
  entry,
  item,
  exercise,
  onBack,
  onComplete,
  onTop,
}: {
  data: CanonicalAppData;
  entry?: MenuEntry;
  item: TrainingItem;
  exercise: Exercise;
  onBack: () => void;
  onComplete: (session: ReturnType<typeof createCanonicalSession>) => void;
  onTop: () => void;
}) {
  const [weight, setWeight] = useState(item.weight ?? 0);
  const [reps, setReps] = useState(item.reps ?? 0);
  const [seconds, setSeconds] = useState(item.seconds ?? 0);
  const [sets, setSets] = useState(item.sets);
  const [seat, setSeat] = useState(item.seat ?? "");
  const [memo, setMemo] = useState("");
  const adjustWeight = (delta: number) =>
    setWeight((value) => Math.max(0, Math.round((value + delta) * 100) / 100));
  const complete = () => {
    if (
      !Number.isInteger(sets) ||
      sets <= 0 ||
      (exercise.measureType === "reps" &&
        (!Number.isInteger(reps) || reps <= 0)) ||
      (exercise.measureType === "time" &&
        (!Number.isInteger(seconds) || seconds <= 0))
    ) {
      alert("回数または時間、セット数は1以上で入力してください。");
      return;
    }
    onComplete(
      createCanonicalSession({
        id: uid(),
        item,
        exercise,
        date: localDate(),
        weight: exercise.usesWeight ? weight : undefined,
        reps: exercise.measureType === "reps" ? reps : undefined,
        seconds: exercise.measureType === "time" ? seconds : undefined,
        sets,
        bodyWeight: data.profile.weight,
        seat: seat || undefined,
        memo: memo || undefined,
        menuEntryId: entry?.id,
      }),
    );
  };
  return (
    <Frame title={item.displayName} back={onBack} onTop={onTop}>
      <p className="week">
        {entry
          ? `週メニュー: ${entry.recommendedDay === undefined ? "任意" : `推奨 ${days[entry.recommendedDay]}`}`
          : "追加トレーニング"}
      </p>
      {exercise.usesWeight && (
        <section className="run-weight">
          <span>重量</span>
          <div className="weight-controls">
            <button
              aria-label="重量を1kg減らす"
              onClick={() => adjustWeight(-1)}
            >
              <strong>&lt;&lt;</strong>
            </button>
            <button
              aria-label="重量を0.25kg減らす"
              onClick={() => adjustWeight(-0.25)}
            >
              &lt;
            </button>
            <b>{weight.toFixed(2)} kg</b>
            <button
              aria-label="重量を0.25kg増やす"
              onClick={() => adjustWeight(0.25)}
            >
              &gt;
            </button>
            <button
              aria-label="重量を1kg増やす"
              onClick={() => adjustWeight(1)}
            >
              <strong>&gt;&gt;</strong>
            </button>
          </div>
        </section>
      )}
      {exercise.measureType === "reps" ? (
        <label>
          回数
          <input
            type="number"
            min="1"
            value={reps}
            onChange={(event) => setReps(Number(event.target.value))}
          />
        </label>
      ) : (
        <label>
          時間 (秒)
          <input
            type="number"
            min="1"
            step="10"
            value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value))}
          />
        </label>
      )}
      <label>
        実施セット数
        <input
          type="number"
          min="1"
          value={sets}
          onChange={(event) => setSets(Number(event.target.value))}
        />
      </label>
      <label>
        シート位置
        <input value={seat} onChange={(event) => setSeat(event.target.value)} />
      </label>
      <label>
        今回メモ
        <input value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>
      <button className="primary" onClick={complete}>
        種目を完了
      </button>
    </Frame>
  );
}

function ExtraPage({
  data,
  onBack,
  onChoose,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  onBack: () => void;
  onChoose: (id: string) => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  return (
    <Frame
      title="追加トレーニング"
      back={onBack}
      onSettings={onSettings}
      onTop={onTop}
    >
      <p className="week">週メニュー外の実施として保存します。</p>
      {active(data.trainingItems).map((item) => {
        const exercise = data.exercises.find(
          (value) => value.id === item.exerciseId,
        );
        return (
          exercise && (
            <button
              className="row"
              key={item.id}
              onClick={() => onChoose(item.id)}
            >
              <span>
                <b>{item.displayName}</b>
                <small>{exercise.name}</small>
              </span>
              <span>›</span>
            </button>
          )
        );
      })}
    </Frame>
  );
}
function HistoryPage({
  data,
  onBack,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  onBack: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const rows = [...data.sessions].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  return (
    <Frame title="実施履歴" back={onBack} onSettings={onSettings} onTop={onTop}>
      {rows.length === 0 ? (
        <p className="week">実施履歴はまだありません。</p>
      ) : (
        rows.map((session) => (
          <section className="card" key={session.id}>
            <b>
              {session.date}　{session.snapshot.trainingItemDisplayName}
            </b>
            <p className="meta">{sessionDetail(session)}</p>
            {session.memo && <p className="meta">{session.memo}</p>}
          </section>
        ))
      )}
    </Frame>
  );
}

const analysisPeriods: Array<{ value: AnalysisPeriod; label: string }> = [
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "quarter", label: "四半期" },
  { value: "year", label: "年" },
];
const analysisColors = ["#2f6f73", "#c47d48", "#7968a8", "#6c9448", "#bd5e77", "#4f7db4"];
const formatLoad = (value: number) => Math.round(value).toLocaleString();
const analysisLabel = (start: string, period: AnalysisPeriod) => {
  const [year, month] = start.split("-");
  if (period === "week") return `${month}/${start.slice(8)}`;
  if (period === "month") return `${year.slice(2)}/${month}`;
  if (period === "quarter") return `${year.slice(2)} Q${Math.floor((Number(month) - 1) / 3) + 1}`;
  return year;
};

function AnalysisChart({ series, labels, unit }: { series: AnalysisSeries[]; labels: string[]; unit: string }) {
  const max = Math.max(1, ...series.flatMap((value) => value.values));
  const width = 640;
  const height = 280;
  const left = 56;
  const top = 22;
  const right = 12;
  const bottom = 48;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const point = (value: number, index: number) => `${left + (innerWidth / Math.max(1, labels.length - 1)) * index},${top + innerHeight - (value / max) * innerHeight}`;
  return (
    <section className="chart" aria-label="分析グラフ">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="トレーニング負荷推移グラフ">
        {[0, 0.5, 1].map((ratio) => (
          <line key={ratio} x1={left} x2={width - right} y1={top + innerHeight * ratio} y2={top + innerHeight * ratio} className="grid" />
        ))}
        <text x="2" y={top + 5}>{formatLoad(max)} {unit}</text>
        <text x="2" y={top + innerHeight / 2 + 5}>{formatLoad(max / 2)}</text>
        <text x="26" y={top + innerHeight}>0</text>
        {labels.map((label, index) => (
          <text key={`${label}-${index}`} className="axis" x={left + (innerWidth / Math.max(1, labels.length - 1)) * index} y={height - 15} textAnchor="middle">{label}</text>
        ))}
        {series.map((value, index) => (
          <polyline key={value.id} points={value.values.map(point).join(" ")} fill="none" stroke={analysisColors[index % analysisColors.length]} strokeWidth="3" />
        ))}
      </svg>
      <div className="legend">
        {series.map((value, index) => <span key={value.id} style={{ color: analysisColors[index % analysisColors.length] }}>● {value.name}</span>)}
      </div>
    </section>
  );
}

function AnalysisPage({ data, onBack, onSettings, onTop }: { data: CanonicalAppData; onBack: () => void; onSettings: () => void; onTop: () => void }) {
  const [period, setPeriod] = useState<AnalysisPeriod>("week");
  const [view, setView] = useState<"overall" | "bodyRegion" | "exercise" | "frequency">("overall");
  const [frequencyKind, setFrequencyKind] = useState<"exercise" | "bodyRegion">("exercise");
  const options = useMemo(() => exerciseOptions(data), [data]);
  const [exerciseId, setExerciseId] = useState("");
  const selectedExerciseId = options.some((value) => value.id === exerciseId) ? exerciseId : (options[0]?.id ?? "");
  const now = localDate();
  const overall = useMemo(() => overallDerivedLoad(data, period, now), [data, period, now]);
  const byBodyRegion = useMemo(() => bodyRegionDerivedLoad(data, period, now), [data, period, now]);
  const actual = useMemo(() => selectedExerciseId ? exerciseActuals(data, selectedExerciseId, period, now) : undefined, [data, selectedExerciseId, period, now]);
  const rows = useMemo(() => frequencyKind === "exercise" ? exerciseFrequency(data, period, now) : bodyRegionFrequency(data, period, now), [data, frequencyKind, period, now]);
  const labels = overall.bucketStarts.map((value) => analysisLabel(value, period));
  const selectedExercise = options.find((value) => value.id === selectedExerciseId);
  const actualWeight = actual ? actual.maxWeight.map((value) => value ?? 0) : [];
  return (
    <Frame title="分析" back={onBack} onSettings={onSettings} onTop={onTop}>
      <label>
        期間
        <select value={period} onChange={(event) => setPeriod(event.target.value as AnalysisPeriod)}>
          {analysisPeriods.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}
        </select>
      </label>
      <div className="view-toggle analysis-toggle" aria-label="分析表示">
        <button className={view === "overall" ? "active" : ""} onClick={() => setView("overall")}>全体負荷</button>
        <button className={view === "bodyRegion" ? "active" : ""} onClick={() => setView("bodyRegion")}>部位別負荷</button>
        <button className={view === "exercise" ? "active" : ""} onClick={() => setView("exercise")}>種目実績</button>
        <button className={view === "frequency" ? "active" : ""} onClick={() => setView("frequency")}>実施頻度</button>
      </div>
      {data.sessions.length === 0 ? (
        <p className="week">この期間に表示できる実施記録はありません。</p>
      ) : view === "overall" ? (
        <>
          <p className="week">自重寄与を含む参考負荷です。保存済み実績とsnapshotから再集計します。</p>
          <AnalysisChart series={[{ id: "overall", name: "全体", values: overall.values }]} labels={labels} unit="負荷" />
        </>
      ) : view === "bodyRegion" ? (
        <>
          <p className="week">部位は実行時のsnapshot分類です。未分類は現在の設定で補完しません。</p>
          {byBodyRegion.series.length ? <AnalysisChart series={byBodyRegion.series} labels={byBodyRegion.bucketStarts.map((value) => analysisLabel(value, period))} unit="負荷" /> : <p className="week">この期間に部位別の実績はありません。</p>}
        </>
      ) : view === "exercise" ? (
        <>
          <label>
            種目
            <select value={selectedExerciseId} onChange={(event) => setExerciseId(event.target.value)}>
              {options.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
            </select>
          </label>
          {!actual || !selectedExercise ? <p className="week">実施記録のある種目を選択してください。</p> : <>
            <p className="week">{selectedExercise.name} の期間ごとの最大重量と、合計回数・セット数です。</p>
            <AnalysisChart series={[{ id: "weight", name: "最大重量 (kg)", values: actualWeight }]} labels={actual.bucketStarts.map((value) => analysisLabel(value, period))} unit="kg" />
            <div className="analysis-table" aria-label="種目実績一覧">
              {actual.bucketStarts.map((start, index) => (
                <section className="card" key={start}>
                  <b>{analysisLabel(start, period)}</b>
                  <p className="meta">最大重量: {actual.maxWeight[index] === undefined ? "—" : `${actual.maxWeight[index]} kg`}　実施: {actual.sessions[index]} 回</p>
                  <p className="meta">合計回数: {actual.reps[index]} 回　合計時間: {actual.seconds[index]} 秒　合計セット: {actual.sets[index]}</p>
                </section>
              ))}
            </div>
          </>}
        </>
      ) : (
        <>
          <label>
            集計対象
            <select value={frequencyKind} onChange={(event) => setFrequencyKind(event.target.value as "exercise" | "bodyRegion")}>
              <option value="exercise">種目別</option>
              <option value="bodyRegion">部位別</option>
            </select>
          </label>
          {rows.length === 0 ? <p className="week">この期間に実施記録はありません。</p> : <div className="analysis-table" aria-label="実施頻度一覧">
            {rows.map((row) => <section className="card" key={row.id}>
              <b>{row.name}</b>
              <p className="meta">実施: {row.sessions} 回　セット: {row.sets}</p>
              <p className="meta">回数: {row.reps} 回　時間: {row.seconds} 秒</p>
            </section>)}
          </div>}
        </>
      )}
    </Frame>
  );
}

function MasterBootstrapPage({
  data,
  onBack,
  onApplied,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  onBack: () => void;
  onApplied: (data: CanonicalAppData) => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const [includeFrontPlank, setIncludeFrontPlank] = useState(false);
  const [mappings, setMappings] = useState<ManMasterBootstrapMapping[]>();
  const [errors, setErrors] = useState<string[]>([]);
  const selected = MAN_MASTER_BOOTSTRAP_PACKAGE.filter((value) => includeFrontPlank || value.sourceExerciseId !== "seed-front");
  const apply = async () => {
    if (!window.confirm("承認済みのMAN用Exerciseと実施項目を投入します。既存の同名マスターがある場合は投入されません。続けますか？")) return;
    const result = await applyManMasterBootstrap(canonicalStorage, data, {
      includeFrontPlank,
      newId: uid,
      now: () => new Date().toISOString(),
    });
    if (!result.ok) {
      setErrors(result.errors.map((value) => `${value.path}: ${value.message}`));
      return;
    }
    onApplied(result.value);
    setMappings(result.mappings);
    setErrors([]);
  };
  return (
    <Frame title="MAN用マスター投入" back={onBack} onSettings={onSettings} onTop={onTop}>
      {mappings ? (
        <>
          <p className="week">投入・canonical検証・保存後read-backが完了しました。下記のTrainingItem IDをMenuProposalで参照できます。</p>
          {mappings.map((mapping) => (
            <section className="card" key={mapping.sourceExerciseId}>
              <b>{mapping.sourceExerciseId} / {mapping.sourceTrainingItemId}</b>
              <p className="meta">Exercise ID: {mapping.exerciseId}</p>
              <p className="meta">TrainingItem ID: {mapping.trainingItemId}</p>
            </section>
          ))}
          <button className="primary" onClick={onBack}>設定へ戻る</button>
        </>
      ) : (
        <>
          <p className="week">Android MAN準備の限定経路です。復元・legacy移行・Menu作成は行いません。</p>
          <section className="card">
            {selected.map((entry) => (
              <p className="meta" key={entry.sourceExerciseId}>
                <b>{entry.exercise.name}</b>　{entry.exercise.measureType === "reps" ? `${entry.trainingItem.weight === undefined ? "自重" : `${entry.trainingItem.weight} kg`} × ${entry.trainingItem.reps} 回` : `${entry.trainingItem.seconds} 秒`} × {entry.trainingItem.sets} セット
              </p>
            ))}
          </section>
          <label className="check">
            <input type="checkbox" checked={includeFrontPlank} onChange={(event) => setIncludeFrontPlank(event.target.checked)} />
            時間型確認用にフロントプランクも投入する
          </label>
          {errors.map((error) => <p className="week danger" key={error}>{error}</p>)}
          <button className="primary" onClick={apply}>承認済みMANマスターを投入</button>
        </>
      )}
    </Frame>
  );
}

function SettingsPage({
  data,
  commit,
  tab,
  onTab,
  onMenuImport,
  onTrainerHistoryExport,
  onAnalysis,
  onMasterBootstrap,
  menuToInspectId,
  onBack,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onMenuImport: () => void;
  onTrainerHistoryExport: () => void;
  onAnalysis: () => void;
  onMasterBootstrap: () => void;
  menuToInspectId?: string;
  onBack: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  return (
    <Frame
      title="正規データの設定"
      back={onBack}
      onSettings={onSettings}
      onTop={onTop}
    >
      <div className="view-toggle">
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => onTab("profile")}
        >
          プロフィール
        </button>
        <button
          className={tab === "exercise" ? "active" : ""}
          onClick={() => onTab("exercise")}
        >
          種目
        </button>
        <button
          className={tab === "item" ? "active" : ""}
          onClick={() => onTab("item")}
        >
          実施項目
        </button>
        <button
          className={tab === "menu" ? "active" : ""}
          onClick={() => onTab("menu")}
        >
          週メニュー
        </button>
        <button
          className={tab === "settingHistory" ? "active" : ""}
          onClick={() => onTab("settingHistory")}
        >
          設定履歴
        </button>
      </div>
      <section className="card">
        <button className="save-setting" onClick={onMasterBootstrap}>
          MAN用マスターを投入
        </button>
        <p className="meta">Android MAN用の承認済みExercise／実施項目だけを新規投入します。週メニューは作成しません。</p>
        <button className="save-setting" onClick={onAnalysis}>
          分析
        </button>
        <p className="meta">実施記録の負荷推移・実績・頻度を確認します。</p>
        <button className="save-setting" onClick={onMenuImport}>
          メニュー投入
        </button>
        <p className="meta">JSONの提案から新しい週メニューを作成します。現在の週メニューは切り替えません。</p>
        <button className="save-setting" onClick={onTrainerHistoryExport}>
          トレーニング履歴出力
        </button>
        <p className="meta">メニュー調整・振り返り等に利用する実施履歴を出力します。アプリ復元用バックアップではありません。</p>
      </section>
      {tab === "profile" && <ProfileEditor data={data} commit={commit} />}{" "}
      {tab === "exercise" && <ExerciseEditor data={data} commit={commit} />}{" "}
      {tab === "item" && <ItemEditor data={data} commit={commit} />}{" "}
      {tab === "menu" && (
        <MenuEditor
          data={data}
          commit={commit}
          initialMenuId={menuToInspectId}
        />
      )}{" "}
      {tab === "settingHistory" && (
        <SettingHistory data={data} commit={commit} />
      )}
    </Frame>
  );
}
function ProfileEditor({
  data,
  commit,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
}) {
  const [profile, setProfile] = useState(data.profile);
  return (
    <section className="card">
      <label>
        体重 (kg)
        <input
          type="number"
          min="0.1"
          value={profile.weight}
          onChange={(event) =>
            setProfile({ ...profile, weight: Number(event.target.value) })
          }
        />
      </label>
      <label>
        身長 (cm)
        <input
          type="number"
          min="0"
          value={profile.height ?? ""}
          onChange={(event) =>
            setProfile({
              ...profile,
              height:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
            })
          }
        />
      </label>
      <label>
        年齢
        <input
          type="number"
          min="1"
          value={profile.age ?? ""}
          onChange={(event) =>
            setProfile({
              ...profile,
              age:
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
            })
          }
        />
      </label>
      <label>
        性別
        <input
          value={profile.sex ?? ""}
          onChange={(event) =>
            setProfile({ ...profile, sex: event.target.value || undefined })
          }
        />
      </label>
      <label>
        週開始曜日
        <select
          value={data.weekStartsOn}
          onChange={(event) =>
            commit({
              ...data,
              weekStartsOn: Number(event.target.value) as RecommendedDay,
            })
          }
        >
          {days.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" onClick={() => commit({ ...data, profile })}>
        プロフィールを保存
      </button>
    </section>
  );
}
function ExerciseEditor({
  data,
  commit,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
}) {
  const blank = (): Exercise => ({
    id: uid(),
    lifecycle: "active",
    name: "",
    measureType: "reps",
    usesWeight: true,
    weightMode: "total",
    classifications: [],
  });
  const [form, setForm] = useState<Exercise>(blank);
  const save = async () => {
    if (!form.name.trim()) return;
    const next = {
      ...form,
      name: form.name.trim(),
      weightMode: form.usesWeight ? (form.weightMode ?? "total") : undefined,
      classifications: form.classifications?.filter((value) =>
        value.label.trim(),
      ),
    };
    if (
      await commit({
        ...data,
        exercises: data.exercises.some((value) => value.id === next.id)
          ? data.exercises.map((value) => (value.id === next.id ? next : value))
          : [...data.exercises, next],
      })
    )
      setForm(blank());
  };
  return (
    <>
      <section className="card">
        <label>
          種目名
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          計測方法
          <select
            value={form.measureType}
            onChange={(event) =>
              setForm({
                ...form,
                measureType: event.target.value as Exercise["measureType"],
                usesWeight:
                  event.target.value === "time" ? false : form.usesWeight,
              })
            }
          >
            <option value="reps">回数型</option>
            <option value="time">時間型</option>
          </select>
        </label>
        {form.measureType === "reps" && (
          <label>
            <input
              type="checkbox"
              checked={form.usesWeight}
              onChange={(event) =>
                setForm({ ...form, usesWeight: event.target.checked })
              }
            />{" "}
            重量を記録する
          </label>
        )}
        {form.usesWeight && (
          <label>
            重量の扱い
            <select
              value={form.weightMode ?? "total"}
              onChange={(event) =>
                setForm({
                  ...form,
                  weightMode: event.target.value as Exercise["weightMode"],
                })
              }
            >
              <option value="total">合計重量（×1）</option>
              <option value="perSide">片側重量（×2）</option>
            </select>
          </label>
        )}
        <label>
          部位（任意）
          <input
            value={form.classifications?.[0]?.label ?? ""}
            onChange={(event) =>
              setForm({
                ...form,
                classifications: event.target.value
                  ? [{ kind: "bodyRegion", label: event.target.value }]
                  : [],
              })
            }
          />
        </label>
        <button className="primary" disabled={!form.name.trim()} onClick={save}>
          {data.exercises.some((value) => value.id === form.id)
            ? "種目を更新"
            : "種目を登録"}
        </button>
      </section>
      {active(data.exercises).map((value) => (
        <button
          className="row"
          key={value.id}
          onClick={() => setForm(clone(value))}
        >
          <span>
            <b>{value.name}</b>
            <small>
              {value.measureType === "reps" ? "回数型" : "時間型"}
              {value.classifications?.[0]
                ? `　${value.classifications[0].label}`
                : ""}
            </small>
          </span>
          <span>編集</span>
        </button>
      ))}
    </>
  );
}

function ItemEditor({
  data,
  commit,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
}) {
  const exercises = active(data.exercises);
  const initial = (): TrainingItem => ({
    id: uid(),
    lifecycle: "active",
    exerciseId: exercises[0]?.id ?? "",
    displayName: "",
    weight: 0,
    reps: 1,
    sets: 1,
  });
  const [form, setForm] = useState<TrainingItem>(initial);
  const [changeReason, setChangeReason] = useState("");
  const selected = exercises.find((value) => value.id === form.exerciseId);
  const exists = data.trainingItems.some((value) => value.id === form.id);
  const save = async () => {
    if (!selected || !form.displayName.trim()) return;
    const normalized: TrainingItem = {
      ...form,
      displayName: form.displayName.trim(),
      weight: selected.usesWeight ? (form.weight ?? 0) : undefined,
      reps: selected.measureType === "reps" ? (form.reps ?? 1) : undefined,
      seconds:
        selected.measureType === "time" ? (form.seconds ?? 1) : undefined,
      sets: form.sets || 1,
    };
    const next = exists
      ? updateTrainingItem(data, normalized, {
          newId: uid,
          now: () => new Date().toISOString(),
          changeReason,
        })
      : addTrainingItem(data, normalized, {
          newId: uid,
          now: () => new Date().toISOString(),
        });
    if (await commit(next)) {
      setForm(initial());
      setChangeReason("");
    }
  };
  return (
    <>
      {exercises.length === 0 ? (
        <p className="week">先に種目を登録してください。</p>
      ) : (
        <section className="card">
          <label>
            元種目
            <select
              value={form.exerciseId}
              onChange={(event) => {
                const exercise = exercises.find(
                  (value) => value.id === event.target.value,
                );
                setForm({
                  ...form,
                  exerciseId: event.target.value,
                  displayName: form.displayName || exercise?.name || "",
                  reps:
                    exercise?.measureType === "reps"
                      ? (form.reps ?? 1)
                      : undefined,
                  seconds:
                    exercise?.measureType === "time"
                      ? (form.seconds ?? 1)
                      : undefined,
                  weight: exercise?.usesWeight ? (form.weight ?? 0) : undefined,
                });
              }}
            >
              {exercises.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            表示名
            <input
              value={form.displayName}
              onChange={(event) =>
                setForm({ ...form, displayName: event.target.value })
              }
            />
          </label>
          {selected?.usesWeight && (
            <label>
              標準重量 (kg)
              <input
                type="number"
                step="0.25"
                min="0"
                value={form.weight ?? 0}
                onChange={(event) =>
                  setForm({ ...form, weight: Number(event.target.value) })
                }
              />
            </label>
          )}
          {selected?.measureType === "reps" ? (
            <label>
              標準回数
              <input
                type="number"
                min="1"
                value={form.reps ?? 1}
                onChange={(event) =>
                  setForm({ ...form, reps: Number(event.target.value) })
                }
              />
            </label>
          ) : (
            <label>
              標準時間 (秒)
              <input
                type="number"
                min="1"
                value={form.seconds ?? 1}
                onChange={(event) =>
                  setForm({ ...form, seconds: Number(event.target.value) })
                }
              />
            </label>
          )}
          <label>
            標準セット数
            <input
              type="number"
              min="1"
              value={form.sets}
              onChange={(event) =>
                setForm({ ...form, sets: Number(event.target.value) })
              }
            />
          </label>
          <label>
            シート位置
            <input
              value={form.seat ?? ""}
              onChange={(event) =>
                setForm({ ...form, seat: event.target.value || undefined })
              }
            />
          </label>
          <label>
            標準メモ
            <input
              value={form.standardMemo ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  standardMemo: event.target.value || undefined,
                })
              }
            />
          </label>
          {exists && (
            <label>
              変更理由（任意）
              <input
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
              />
            </label>
          )}
          <button className="primary" onClick={save}>
            {exists ? "実施項目を更新" : "実施項目を登録"}
          </button>
        </section>
      )}
      {active(data.trainingItems).map((value) => (
        <button
          className="row"
          key={value.id}
          onClick={() => {
            setForm(clone(value));
            setChangeReason("");
          }}
        >
          <span>
            <b>{value.displayName}</b>
            <small>
              {data.exercises.find(
                (exercise) => exercise.id === value.exerciseId,
              )?.name ?? "参照不明"}
            </small>
          </span>
          <span>編集</span>
        </button>
      ))}
    </>
  );
}
function MenuEditor({
  data,
  commit,
  initialMenuId,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  initialMenuId?: string;
}) {
  const [menuId, setMenuId] = useState(
    initialMenuId ?? data.activeMenuId ?? active(data.menus)[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [itemId, setItemId] = useState("");
  const [day, setDay] = useState<string>("");
  const menu = data.menus.find(
    (value) => value.id === menuId && value.lifecycle === "active",
  );
  const create = async () => {
    if (!name.trim()) return;
    const value: Menu = { id: uid(), lifecycle: "active", name: name.trim() };
    if (
      await commit({
        ...data,
        menus: [...data.menus, value],
        activeMenuId: data.activeMenuId ?? value.id,
      })
    ) {
      setMenuId(value.id);
      setName("");
    }
  };
  const add = async () => {
    if (!menu || !itemId) return;
    const item = data.trainingItems.find((value) => value.id === itemId);
    if (
      !item ||
      !confirm(`「${item.displayName}」を週メニューに追加しますか？`)
    )
      return;
    const next = appendMenuEntry(
      data,
      {
        lifecycle: "active",
        menuId: menu.id,
        trainingItemId: itemId,
        recommendedDay:
          day === "" ? undefined : (Number(day) as RecommendedDay),
      },
      { newId: uid, now: () => new Date().toISOString() },
    );
    if (await commit(next)) {
      setItemId("");
      setDay("");
    }
  };
  return (
    <>
      <section className="card">
        <label>
          週メニュー
          <select
            value={menuId}
            onChange={(event) => setMenuId(event.target.value)}
          >
            <option value="">選択してください</option>
            {active(data.menus).map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          新しい週メニュー名
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="primary" disabled={!name.trim()} onClick={create}>
          週メニューを登録
        </button>
      </section>
      {menu && (
        <section className="card">
          <h2>{menu.name}</h2>
          <label>
            実施項目
            <select
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="">選択してください</option>
              {active(data.trainingItems).map((value) => (
                <option key={value.id} value={value.id}>
                  {value.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            推奨曜日
            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
            >
              <option value="">任意</option>
              {days.map((value, index) => (
                <option key={value} value={index}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!itemId} onClick={add}>
            実施項目を追加
          </button>
          {data.menuEntries
            .filter(
              (value) =>
                value.menuId === menu.id && value.lifecycle === "active",
            )
            .sort((a, b) => a.order - b.order)
            .map((entry) => {
              const item = data.trainingItems.find(
                (value) => value.id === entry.trainingItemId,
              );
              return (
                <button
                  className="row"
                  key={entry.id}
                  onClick={() => commit(archiveMenuEntry(data, entry.id))}
                >
                  <span>
                    <b>{item?.displayName ?? "参照不明"}</b>
                    <small>
                      {entry.recommendedDay === undefined
                        ? "任意"
                        : `推奨：${days[entry.recommendedDay]}`}
                    </small>
                  </span>
                  <span>外す</span>
                </button>
              );
            })}
        </section>
      )}
    </>
  );
}
function SettingHistory({
  data,
  commit,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
}) {
  const rows = [...data.trainingItemSettingChanges].sort((a, b) =>
    b.changedAt.localeCompare(a.changedAt),
  );
  const remove = async (id: string, itemId: string) => {
    if (!confirm("この設定変更履歴を削除しますか？")) return;
    try {
      await commit(deleteTrainingItemSettingChange(data, itemId, id));
    } catch (error) {
      alert(`削除できません: ${String(error)}`);
    }
  };
  return (
    <section className="card">
      <h2>設定変更履歴</h2>
      {rows.length === 0 ? (
        <p className="week">設定変更履歴はまだありません。</p>
      ) : (
        rows.map((change) => {
          const item = data.trainingItems.find(
            (value) => value.id === change.trainingItemId,
          );
          const measure =
            change.snapshot.reps === undefined
              ? `${change.snapshot.seconds ?? 0} 秒`
              : `${change.snapshot.weight ?? 0} kg × ${change.snapshot.reps} 回`;
          return (
            <section className="meta" key={change.id}>
              <b>
                {item?.displayName ?? "参照不明"}　{change.changedAt}
              </b>
              <p>
                {measure} × {change.snapshot.sets} セット
                {change.snapshot.seat
                  ? `　シート: ${change.snapshot.seat}`
                  : ""}
              </p>
              {change.changeReason && <p>変更理由: {change.changeReason}</p>}
              {change.isInitial ? (
                <small>初回設定（削除できません）</small>
              ) : (
                <button
                  className="small danger"
                  onClick={() => remove(change.id, change.trainingItemId)}
                >
                  削除
                </button>
              )}
            </section>
          );
        })
      )}
    </section>
  );
}

function formatIssues(rows: { path: string; message: string }[]) {
  return (
    <ul className="meta">
      {rows.map((row) => (
        <li key={`${row.path}:${row.message}`}>
          {row.path}: {row.message}
        </li>
      ))}
    </ul>
  );
}

function MenuImportPage({
  data,
  onBack,
  onApplied,
  onInspectMenu,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  onBack: () => void;
  onApplied: (next: CanonicalAppData) => void;
  onInspectMenu: (menuId: string) => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const [checked, setChecked] = useState<ReturnType<typeof validateMenuProposal>>({
    errors: [],
    warnings: [],
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState<{ id: string; name: string }>();
  const read = (file?: File) => {
    if (!file) return;
    setAcknowledged(false);
    setMessage("");
    const reader = new FileReader();
    reader.onerror = () => {
      setChecked({ errors: [{ path: "file", message: "ファイルを読み込めませんでした" }], warnings: [] });
    };
    reader.onload = () => {
      try {
        setChecked(validateMenuProposal(JSON.parse(String(reader.result)), data));
      } catch (error) {
        setChecked({ errors: [{ path: "JSON", message: `JSONを解析できません: ${String(error)}` }], warnings: [] });
      }
    };
    reader.readAsText(file, "UTF-8");
  };
  const apply = async () => {
    if (applied || !checked.proposal || checked.errors.length || (checked.warnings.length && !acknowledged)) return;
    if (!confirm("既存の週メニューを上書きせず、新しい週メニューを作成します。投入しますか？")) return;
    const result = await applyMenuProposal(canonicalStorage, data, checked.proposal, uid);
    if (!result.ok) {
      setMessage(`投入に失敗しました。${result.errors.map((row) => `${row.path}: ${row.message}`).join(" / ")}`);
      return;
    }
    onApplied(result.value);
    setApplied({ id: result.menu.id, name: result.menu.name });
  };
  const proposal = checked.proposal;
  return (
    <Frame title="メニュー投入" back={onBack} onSettings={onSettings} onTop={onTop}>
      <section className="card">
        <p className="meta">提案JSONを確認してから、新しい週メニューとして作成します。アプリ復元用バックアップは選択できません。</p>
        <label>
          提案ファイルを選択
          <input type="file" accept="application/json,.json" onChange={(event) => read(event.target.files?.[0])} />
        </label>
      </section>
      {checked.errors.length > 0 && (
        <section className="card">
          <h2>投入できません</h2>
          {formatIssues(checked.errors)}
        </section>
      )}
      {proposal && checked.errors.length === 0 && !applied && (
        <section className="card">
          <h2>内容確認</h2>
          <p><b>{proposal.menu.name}</b>　{proposal.entries.length}件</p>
          {proposal.menu.memo && <p className="meta">{proposal.menu.memo}</p>}
          {proposal.entries
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((entry) => (
              <p className="meta" key={`${entry.order}:${entry.trainingItemId}`}>
                {entry.order + 1}. {data.trainingItems.find((item) => item.id === entry.trainingItemId)?.displayName ?? entry.trainingItemId}
                {"　"}{entry.recommendedDay === undefined ? "推奨：任意" : `推奨：${days[entry.recommendedDay]}`}
              </p>
            ))}
          {checked.warnings.length > 0 && (
            <>
              <h3>確認が必要な項目</h3>
              {formatIssues(checked.warnings)}
              <label>
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{" "}
                内容を確認しました
              </label>
            </>
          )}
          <button className="primary" disabled={checked.warnings.length > 0 && !acknowledged} onClick={apply}>
            新しい週メニューを作成
          </button>
        </section>
      )}
      {applied && (
        <section className="card">
          <h2>メニューを作成しました</h2>
          <p><b>{applied.name}</b></p>
          <p className="meta">現在使用中の週メニューは変更していません。</p>
          <button className="primary" onClick={() => onInspectMenu(applied.id)}>
            週メニューで内容を確認
          </button>
        </section>
      )}
      {message && <p className="week">{message}</p>}
    </Frame>
  );
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TrainerHistoryExportPage({
  data,
  onBack,
  onSettings,
  onTop,
}: {
  data: CanonicalAppData;
  onBack: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const today = localDate();
  const [fullHistory, setFullHistory] = useState(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [message, setMessage] = useState("");
  const preview = createTrainerHistory(data, {
    fullHistory,
    fromDate,
    toDate,
    generatedAt: new Date().toISOString(),
  });
  const exportHistory = () => {
    if (!preview.ok) return;
    if (preview.value.sessions.length === 0) {
      setMessage("対象期間に履歴がありません。");
      return;
    }
    try {
      const suffix = fullHistory ? `full-${today}` : `${fromDate}_${toDate}`;
      downloadJson(`training-check-trainer-history-${suffix}.json`, preview.value);
      setMessage(`${preview.value.sessions.length}件の実施履歴を出力しました。`);
    } catch (error) {
      setMessage(`出力に失敗しました: ${String(error)}`);
    }
  };
  return (
    <Frame title="トレーニング履歴出力" back={onBack} onSettings={onSettings} onTop={onTop}>
      <section className="card">
        <p className="meta">メニュー調整・振り返り等に利用する実施履歴を出力します。アプリ復元用バックアップではありません。</p>
        <label>
          <input type="checkbox" checked={fullHistory} onChange={(event) => setFullHistory(event.target.checked)} /> 全履歴を出力する
        </label>
        {!fullHistory && (
          <>
            <label>開始日<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label>終了日<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <p className="meta">開始日・終了日を含む期間で出力します。</p>
          </>
        )}
        {!preview.ok ? formatIssues(preview.errors) : <p className="meta">対象Session: {preview.value.sessions.length}件</p>}
        <button className="primary" disabled={!preview.ok || preview.value.sessions.length === 0} onClick={exportHistory}>
          JSONを出力
        </button>
      </section>
      {message && <p className="week">{message}</p>}
    </Frame>
  );
}

export function CanonicalCutover({
  profile,
  legacySource,
  onSuccess,
  onBack,
}: {
  profile: { weight: number; height?: number; age?: number; sex?: string };
  legacySource: unknown;
  onSuccess: (data: CanonicalAppData) => void;
  onBack: () => void;
}) {
  const [adoptProfile, setAdoptProfile] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const candidate = useMemo(
    () => createInitialCanonicalCandidate(profile),
    [profile],
  );
  const validation = validateCanonical(candidate);
  const profileFields = [
    ["体重", `${candidate.profile.weight} kg`],
    ...(candidate.profile.height === undefined
      ? []
      : ([["身長", `${candidate.profile.height} cm`]] as const)),
    ...(candidate.profile.age === undefined
      ? []
      : ([["年齢", `${candidate.profile.age}`]] as const)),
    ...(candidate.profile.sex === undefined
      ? []
      : ([["性別", candidate.profile.sex]] as const)),
  ];
  const preflight = async () => {
    setMessage("");
    const result = await prepareCanonicalCutover(
      canonicalStorage,
      legacySource,
      candidate,
      new Date().toISOString(),
    );
    if (result.ok) {
      setReady(true);
      setMessage(
        "準備完了: legacy sourceの検証とprotected baselineの保存・read-backを確認しました。",
      );
    } else {
      setReady(false);
      setMessage(
        `準備に失敗しました: ${result.diagnostics.map((value) => `${value.stage}: ${value.message}`).join(" / ")}`,
      );
    }
  };
  const execute = async () => {
    if (!adoptProfile || !acknowledge || !ready || validation.errors.length)
      return;
    if (
      !confirm(
        "正規データへ切り替えます。旧データへ自動では戻りません。続けますか？",
      )
    )
      return;
    const result = await cutoverCanonical(
      canonicalStorage,
      legacySource,
      candidate,
      new Date().toISOString(),
    );
    if (result.ok) onSuccess(result.value);
    else
      setMessage(
        result.diagnostics
          .map((value) => `${value.stage}: ${value.message}`)
          .join(" / "),
      );
  };
  return (
    <main className="app">
      <button className="back" onClick={onBack}>
        ‹ データ管理
      </button>
      <h1>正規データへ切替</h1>
      <section className="card">
        <p>
          旧データの種目・実施項目・週メニュー・実施履歴・設定履歴は自動移行しません。
        </p>
        <p>初期正規データに採用するProfile候補:</p>
        <ul>
          {profileFields.map(([label, value]) => (
            <li key={label}>
              {label}: {value}
            </li>
          ))}
        </ul>
        <p className="meta">
          初期candidate: 種目 0件、実施項目 0件、週メニュー 0件、実施履歴 0件
        </p>
        <h2>切替前の準備</h2>
        <p className="meta">
          legacy
          sourceの検証と、切替前baselineの保存・read-backを行います。準備だけではcanonicalを正本に切り替えません。
        </p>
        <button
          className="save-setting"
          disabled={validation.errors.length > 0}
          onClick={preflight}
        >
          切替準備を確認
        </button>
        {ready && <p className="meta">baseline / Recovery準備: 確認済み</p>}
        <label>
          <input
            type="checkbox"
            checked={adoptProfile}
            onChange={(event) => setAdoptProfile(event.target.checked)}
          />{" "}
          表示したProfile候補を採用する
        </label>
        <label>
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(event) => setAcknowledge(event.target.checked)}
          />{" "}
          切替後は正規データが正本であり、旧データへ自動復帰しないことを確認した
        </label>
        {validation.errors.length > 0 && (
          <ul>
            {validation.errors.map((value) => (
              <li key={value.path}>
                {value.path}: {value.message}
              </li>
            ))}
          </ul>
        )}
        <button
          className="primary"
          disabled={
            !ready ||
            !adoptProfile ||
            !acknowledge ||
            validation.errors.length > 0
          }
          onClick={execute}
        >
          正規データへ切替
        </button>
        {message && <p className="week">{message}</p>}
      </section>
    </main>
  );
}
export function CanonicalRecovery({
  errors,
  onRecovered,
}: {
  errors: string[];
  onRecovered: (data: CanonicalAppData) => void;
}) {
  const [message, setMessage] = useState("");
  const restore = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const prepared = prepareCanonicalBackupRestore(String(reader.result));
      if (!prepared.ok) {
        setMessage(
          prepared.diagnostics
            .map((value) => `${value.stage}: ${value.message}`)
            .join(" / "),
        );
        return;
      }
      const result = await recoverCanonical(canonicalStorage, {
        format: "training-check-backup",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        payload: prepared.value,
      });
      if (result.ok) onRecovered(result.value);
      else
        setMessage(
          result.diagnostics
            .map((value) => `${value.stage}: ${value.message}`)
            .join(" / "),
        );
    };
    reader.readAsText(file);
  };
  return (
    <main className="app">
      <h1>正規データを読み込めません</h1>
      <p>
        通常画面へ自動復帰していません。正規バックアップから明示的に復旧してください。
      </p>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      <label>
        正規バックアップを選択
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => restore(event.target.files?.[0])}
        />
      </label>
      {message && <p className="week">{message}</p>}
    </main>
  );
}
