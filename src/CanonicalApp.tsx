import { DisplayPreferencesEditor, DisplayPreferencesSummary, OptionSort } from "./DisplayPreferencesEditor";
import { bodyRegions, compareBodyRegions, compareNames, effectiveDisplayPreferences, exerciseBodyRegion, recentlyPerformedExercises, sortDisplayRows } from "./canonical/displayPreferences";
import { compareInstants } from "./canonical/instant";
import { useMemo, useRef, useState } from "react";
import { currentWeekSessions, shiftLocalDate, weeklyLoadSummary } from "./canonical/baseline";
import { completedEntryIds, completedSessionRows, displayedSessionOrder, type CompletedSessionRow } from "./canonical/topProjection";
import { cancelSession } from "./canonical/cancelSession";
import { itemValidationMessages } from "./itemValidation";
import { applyCanonicalRestore, createCanonicalBackup, previewCanonicalRestore, type BackupPreview } from "./canonical/backup";
import { canonicalStorage, commitOwnerCanonical } from "./data";
import { TrainerPanel, TrainerManagementOff } from "./TrainerPanel";
import { buildIdentifier } from "./buildInfo";
import {
  addTrainingItem,
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
  applyManMasterBootstrap,
  createAndroidManMenuProposal,
  referenceTrainingLoad,
  analysisBucketStart,
  analysisBucketStarts,
  MAN_MASTER_BOOTSTRAP_PACKAGE,
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
  | "cat"
  | "run"
  | "extra"
  | "settings"
  | "trainer"
  | "history"
  | "analysis"
  | "masterBootstrap"
  | "menuImport"
  | "trainerHistoryExport"
  | "backup";
type SettingsTab =
  | "profile"
  | "exercise"
  | "item"
  | "menu"
  | "settingHistory"
  | "displayPreferences";
type ListPreferences = Record<"exercise" | "item", { filter: string; hidden: boolean }>;
type TopPreferences = { mode: "category" | "recommended"; days: RecommendedDay[]; showCompleted: boolean };
const days = ["月", "火", "水", "木", "金", "土", "日"];
const standardBodyRegions = ["胸", "肩", "腕", "背中", "体幹", "下半身"] as const;
type BodyRegionChoice = "unset" | "custom" | (typeof standardBodyRegions)[number];
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
          aria-expanded={open}
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
  outerHeader = false,
  className = "",
}: {
  outerHeader?: boolean;
  className?: string;
  title: string;
  children: React.ReactNode;
  back?: () => void;
  onSettings?: () => void;
  onTop: () => void;
}) {
  const header = <Header title={title} back={back} onSettings={onSettings} onTop={onTop} />;
  return outerHeader ? <div className="page-frame">{header}<main className={`app ${className}`}>{children}</main></div> : <main className={`app ${className}`}>{header}{children}</main>;
}

function SectionFrame({ embedded, ...props }: React.ComponentProps<typeof Frame> & { embedded?: boolean }) {
  return embedded ? <>{props.children}</> : <Frame {...props} />;
}

export function CanonicalApp({ initial }: { initial: CanonicalAppData }) {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState<Page>("top");
  const [runEntryId, setRunEntryId] = useState<string>();
  const [selectedRegion, setSelectedRegion] = useState<string>();
  const [extraItemId, setExtraItemId] = useState<string>();
  const [viewSessionId, setViewSessionId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [listPreferences, setListPreferences] = useState<ListPreferences>({ exercise: { filter: "", hidden: false }, item: { filter: "", hidden: false } });
  const [topPreferences, setTopPreferences] = useState<TopPreferences>({ mode: "recommended", days: [dayOf(localDate())], showCompleted: false });
  const [itemEditId, setItemEditId] = useState<string | null>();
  const [exerciseEditId, setExerciseEditId] = useState<string>();
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");
  const [menuToInspectId, setMenuToInspectId] = useState<string>();
  const [itemPresetExerciseId, setItemPresetExerciseId] = useState<string>();
  const writeBusy = useRef(false);
  const commit = async (next: CanonicalAppData) => {
    if (writeBusy.current || needsRecovery) return false;
    const checked = validateCanonical(next);
    if (checked.errors.length) {
      setNotice(
        `保存できません: ${checked.errors.map((value) => `${value.path} ${value.message}`).join(" / ")}`,
      );
      return false;
    }
    writeBusy.current = true;
    let persisted = false;
    try {
      const saved = await commitOwnerCanonical(data, next);
      persisted = true;
      setData(saved);
      setNotice("");
      return true;
    } catch (error) {
      setNotice(`保存に失敗しました: ${String(error)}`);
      if (persisted || (error as {canonicalUnknown?:boolean}).canonicalUnknown) setNeedsRecovery(true);
      return false;
    } finally { writeBusy.current = false; }
  };
  const toTop = () => {
    if (writeBusy.current) return;
    setPage("top");
    setSelectedRegion(undefined);
    setRunEntryId(undefined);
    setExtraItemId(undefined);
    setViewSessionId(undefined);
  };
  const exerciseFor = (item: TrainingItem) =>
    data.exercises.find((value) => value.id === item.exerciseId);
  const activeMenu = data.menus.find(
    (value) => value.id === data.activeMenuId && value.lifecycle === "active",
  );
  const finish = async (session: ReturnType<typeof createCanonicalSession>) => {
    if (await commit({ ...data, sessions: [...data.sessions.filter(row => row.id !== session.id), session] })) { if (selectedRegion && runEntryId) setPage("cat"); else toTop(); return true; }
    return false;
  };
  const openSettings = (tab: SettingsTab = "profile", menuId?: string) => {
    if (writeBusy.current) return;
    setExerciseEditId(undefined);
    setSettingsTab(tab);
    setMenuToInspectId(menuId);
    setPage("settings");
  };
  const editExercise = (id: string) => { openSettings("exercise"); setExerciseEditId(id); };
  const header = { onSettings: () => openSettings(), onTop: toTop };
  if (needsRecovery) return <Frame title="保存状態の確認" onTop={() => {}}>
    <p role="alert">保存の成功を確認できません。保存状態を再読込するまで通常編集へ戻れません。</p><p role="status">{notice}</p>
    <button className="primary" onClick={() => location.reload()}>保存状態を再読込</button>
  </Frame>;
  if (page === "run" && runEntryId) {
    const entry = data.menuEntries.find((value) => value.id === runEntryId);
    const item =
      entry &&
      data.trainingItems.find((value) => value.id === entry.trainingItemId);
    const exercise = item && exerciseFor(item);
    if (entry && item && exercise)
      return (
        <RunPage
          key={`entry:${entry.id}`}
          data={data}
          entry={entry}
          item={item}
          exercise={exercise}
          onBack={() => selectedRegion ? setPage("cat") : toTop()}
          onComplete={finish}
          commit={commit}
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
    const selectedSession = data.sessions.find(session => session.id === viewSessionId);
    if (viewSessionId && !selectedSession) return <Frame title="実施記録がありません" back={toTop} {...header}><p>選択した実施記録は取り消されています。</p></Frame>;
    const item = data.trainingItems.find((value) => value.id === extraItemId);
    const exercise = item && exerciseFor(item);
    if (item && exercise)
      return (
        <RunPage
          key={viewSessionId ? `session:${viewSessionId}` : `extra:${item.id}`}
          data={data}
          entry={selectedSession?.menuEntryId ? data.menuEntries.find(entry => entry.id === selectedSession.menuEntryId) : undefined}
          item={item}
          exercise={exercise}
          completedSession={selectedSession}
          onBack={() => selectedSession && selectedRegion ? setPage("cat") : toTop()}
          onComplete={finish}
          commit={commit}
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
        onEditExercise={editExercise}
        {...header}
      />
    );
  if (page === "history")
    return <HistoryPage data={data} onBack={toTop} {...header} />;
  if (page === "analysis")
    return <AnalysisPage data={data} onBack={() => openSettings()} {...header} />;
  if (page === "trainer") return (
    <Frame title="トレーナー連携" back={() => openSettings()} {...header}>
      <TrainerPanel data={data} onApplied={next => setData(next)} onPending={value => { writeBusy.current = value; }} />
    </Frame>
  );
  if (page === "masterBootstrap" && import.meta.env.DEV)
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
  if (page === "menuImport" || page === "trainerHistoryExport") return (
    <Frame title="トレーナー連携" back={() => openSettings()} {...header}>
      <TrainerPanel data={data} onApplied={next => setData(next)} onPending={value => { writeBusy.current = value; }} />
    </Frame>
  );
  if (page === "backup")
    return <BackupPage data={data} onApplied={next => { setData(next); setMenuToInspectId(undefined); setItemEditId(undefined); setItemPresetExerciseId(undefined); setRunEntryId(undefined); setExtraItemId(undefined); setNotice(""); }} onBack={() => openSettings()} {...header} />;
  if (page === "settings")
    return (
      <SettingsPage
        exerciseEditId={exerciseEditId}
        notice={notice}
        listPreferences={listPreferences}
        onListPreferences={setListPreferences}
        data={data}
        commit={commit}
        tab={settingsTab}
        onTab={(next) => {
          setSettingsTab(next);
          setItemEditId(undefined);
          setItemPresetExerciseId(undefined);
        }}
        itemPresetExerciseId={itemPresetExerciseId}
        itemEditId={itemEditId}
        onEditItem={setItemEditId}
        onItemList={() => { setItemEditId(undefined); setItemPresetExerciseId(undefined); }}
        onBackup={() => setPage("backup")}
        onConfigureExercise={(exerciseId) => {
          setItemPresetExerciseId(exerciseId);
          setItemEditId(null);
          setSettingsTab("item");
        }}
        menuToInspectId={menuToInspectId}
        onMenuImport={() => setPage("trainer")}
        onTrainerHistoryExport={() => setPage("trainer")}
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
            value.menuId === activeMenu.id && value.lifecycle === "active" && data.trainingItems.some(item => item.id === value.trainingItemId && item.lifecycle === "active" && data.exercises.some(exercise => exercise.id === item.exerciseId && exercise.lifecycle === "active")),
        )
        .sort((a, b) => a.order - b.order)
    : [];
  return (
    <TopPage
      key={page === "cat" ? selectedRegion : "top"}
      data={data}
      activeMenu={activeMenu}
      entries={entries}
      notice={notice}
      preferences={topPreferences}
      onPreferences={setTopPreferences}
      commit={commit}
      onRun={(id) => {
        setRunEntryId(id);
        setPage("run");
      }}
      region={page === "cat" ? selectedRegion : undefined}
      onEditExercise={editExercise}
      onCategory={region => { setSelectedRegion(region); setPage("cat"); }}
      onActual={session => { setViewSessionId(session.id); setExtraItemId(session.trainingItemId); setPage("extra"); }}
      onExtra={() => setPage("extra")}
      onHistory={() => setPage("history")}
      {...header}
    />
  );
}

function TopPage({
  onEditExercise,
  region,
  onCategory,
  onActual,
  data,
  preferences,
  onPreferences,
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
  onEditExercise: (id: string) => void;
  region?: string;
  onCategory: (region: string) => void;
  onActual: (session: Session) => void;
  data: CanonicalAppData;
  activeMenu?: Menu;
  entries: MenuEntry[];
  preferences: TopPreferences;
  onPreferences: (value: TopPreferences) => void;
  notice: string;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  onRun: (id: string) => void;
  onExtra: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const today = localDate();
  const regionOrder = effectiveDisplayPreferences(data).bodyRegionOrder;
  const currentDay = dayOf(today);
  const start = weekStart(today, data.weekStartsOn);
  const selectedDays = [...preferences.days].sort((left, right) => left - right);
  const topMode = preferences.mode;
  const [option, setOption] = useState(false);
  const [categoryShowCompleted, setCategoryShowCompleted] = useState(false);
  const [dayFilterOpen, setDayFilterOpen] = useState(false);
  const weekSessions = currentWeekSessions(data, today).sort(displayedSessionOrder);
  const completedEntries = completedEntryIds(data, entries, weekSessions);
  const sortEntries = (rows: MenuEntry[]) => sortDisplayRows(rows, entry => {
    const item = data.trainingItems.find(item => item.id === entry.trainingItemId)!;
    const exercise = data.exercises.find(exercise => exercise.id === item.exerciseId)!;
    return { id: entry.id, name: item.displayName || exercise.name, recommendedDay: entry.recommendedDay, bodyRegion: exerciseBodyRegion(exercise), completed: completedEntries.has(entry.id) };
  }, effectiveDisplayPreferences(data), option, region ? ['recommendedDay', 'completion'] : ['recommendedDay', 'completion', 'bodyRegion']);
  const completedRows = completedSessionRows(weekSessions);
  const todayEntries = entries.filter(entry => entry.recommendedDay === currentDay);
  const distinctCount = (rows: MenuEntry[]) => new Set(rows.map(entry => data.trainingItems.find(item => item.id === entry.trainingItemId)?.exerciseId)).size;
  // Numerators count the same Session rows shown in the completed list.
  const todayCompleted = completedRows.filter(row => row.session.date === today).length;
  const selectedDayCompletedRows = completedRows.filter(row => selectedDays.includes(dayOf(row.session.date)));
  const load = weeklyLoadSummary(data, today);
  const toggleDay = (day: RecommendedDay) => onPreferences({ ...preferences, days: selectedDays.includes(day) ? selectedDays.filter(value => value !== day) : [...selectedDays, day] });
  const recommendedEntries = entries.filter(
    (entry) =>
      entry.recommendedDay !== undefined &&
      selectedDays.includes(entry.recommendedDay),
  );
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, MenuEntry[]>();
    entries.forEach((entry) => {
      const item = data.trainingItems.find(
        (value) => value.id === entry.trainingItemId && value.lifecycle === "active",
      );
      const exercise =
        item &&
        data.exercises.find(
          (value) => value.id === item.exerciseId && value.lifecycle === "active",
        );
      if (!item || !exercise) return;
      const bodyRegion = exerciseBodyRegion(exercise) ?? "";
      groups.set(bodyRegion, [...(groups.get(bodyRegion) ?? []), entry]);
    });
    return [...groups.entries()].sort(([left], [right]) => {
      return compareBodyRegions(left, right, regionOrder);
    });
  }, [data.exercises, data.trainingItems, entries, regionOrder.join("\0")]);
  const renderEntry = (entry: MenuEntry) => {
    const item = data.trainingItems.find(
      (value) => value.id === entry.trainingItemId,
    );
    const exercise =
      item && data.exercises.find((value) => value.id === item.exerciseId);
    if (
      !item ||
      !exercise ||
      item.lifecycle !== "active" ||
      exercise.lifecycle !== "active"
    )
      return null;
    const completed = completedEntries.has(entry.id);
    return (
      <div key={entry.id}>
      <button
        className="row item item-density"
        data-menu-entry-id={entry.id}
        onClick={() => onRun(entry.id)}
      >
        <span>
          <span className="item-title-line"><b>{item.displayName || exercise.name}</b><span className={completed ? "ok item-status" : "item-status"}>{completed ? "✓ 実施済" : "未実施"}</span></span>
          <span className="item-detail-line">
            <small>{`${exerciseBodyRegion(exercise) ?? ""}　${entry.recommendedDay === undefined ? "推奨：任意" : `推奨：${days[entry.recommendedDay]}`}`}</small>
            <small className="item-history">{exerciseHistory(data.sessions, exercise.id, new Date(), data.weekStartsOn)}</small>
          </span>
        </span>
      </button>
      <RegionWarning exercise={exercise} onEdit={onEditExercise} />
      </div>
    );
  };
  const renderCompleted = ({ session, label }: CompletedSessionRow) => (
    <button className="row item item-density" data-session-id={session.id}
      data-session-menu-entry-id={session.menuEntryId} key={session.id} onClick={() => onActual(session)}>
      <span><span className="item-title-line"><b>{label}</b><span className="ok item-status">✓ 実施済</span></span><span className="item-detail-line">
        <small>{session.menuEntryId ? "実施記録" : "追加実施"}　{session.date}</small>
        <small className="item-history">{exerciseHistory(data.sessions, session.snapshot.exerciseId, new Date(), data.weekStartsOn)}</small>
      </span></span>
    </button>
  );
  // Include snapshot-only destinations so Extra remains discoverable even when
  // no current planned candidate belongs to its historical region.
  const categoryDestinations = [...new Set([
    ...categoryGroups.map(([name]) => name),
    ...completedRows.flatMap(row => row.bodyRegion ? [row.bodyRegion] : []),
  ])].filter(Boolean).sort((left, right) => compareBodyRegions(left, right, regionOrder));
  return (
    <Frame title={region ?? "今週の実施メニュー"} back={region ? onTop : undefined} onSettings={onSettings} onTop={onTop}>
      {region ? <>
        <div className="list-checks"><label className="check"><input type="checkbox" checked={categoryShowCompleted} onChange={event => setCategoryShowCompleted(event.target.checked)} />実施済も表示</label><OptionSort checked={option} onChange={setOption} /></div>
        <div data-projection="planned">{sortEntries(categoryGroups.find(([name]) => name === region)?.[1] ?? []).map(renderEntry)}</div>
        {categoryShowCompleted && <div data-projection="actual">{completedRows.filter(row => row.bodyRegion === region).map(renderCompleted)}</div>}
      </> : <>
      {notice && <p className="week">{notice}</p>}
      <select aria-label="週メニュー"
          value={activeMenu?.id ?? ""}
          onChange={async (event) =>
            await commit({
              ...data,
              activeMenuId: event.target.value || undefined,
            })
          }
        >
          <option value="">選択してください</option>
          {active(data.menus).sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id)).map((menu) => (
            <option key={menu.id} value={menu.id}>
              {menu.name}
            </option>
          ))}
        </select>
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
          <p className="week">{start} 〜 {shiftLocalDate(start, 6)}</p>
          <div className="totals">
            <span>今日の実施総数<b>{todayCompleted}/{distinctCount(todayEntries)}</b></span>
            <span>今週の実施総数<b>{completedRows.length}/{entries.length}</b></span>
          </div>
          <div className="top-switch" aria-label="実施項目の表示方法">
            <button
              className={topMode === "category" ? "active" : ""}
              onClick={() => onPreferences({ ...preferences, mode: "category" })}
            >
              部位表示
            </button>
            <button
              className={topMode === "recommended" ? "active" : ""}
              onClick={() => onPreferences({ ...preferences, mode: "recommended" })}
            >
              推奨曜日
            </button>
          </div>
          <button className="extra-button" onClick={onExtra}>＋ 追加トレーニングを登録</button>
          {topMode === "category" ? (
            <>
              {sortEntries(categoryGroups.find(([name]) => name === "")?.[1] ?? []).map(renderEntry)}
              {categoryDestinations.length === 0 ? (
                <p className="week">部位表示できる実施項目はありません。</p>
              ) : (
                categoryDestinations.map(bodyRegion => {
                  const groupEntries = categoryGroups.find(([name]) => name === bodyRegion)?.[1] ?? [];
                  return <button className="row" key={bodyRegion} onClick={() => onCategory(bodyRegion)}><span><b>{bodyRegion}</b><small>{groupEntries.length ? `${groupEntries.length}項目` : "実施記録"}</small></span>{groupEntries.length > 0 && <span>{completedRows.filter(row => row.bodyRegion === bodyRegion).length}/{groupEntries.length}</span>}</button>;
                })
              )}
            </>
          ) : (
            <>
              <h2 className="recommended-title">推奨曜日の実施項目</h2>
              <div className="list-checks"><label className="check"><input type="checkbox" checked={preferences.showCompleted} onChange={event => onPreferences({ ...preferences, showCompleted: event.target.checked })} />実施済も表示</label><OptionSort checked={option} onChange={setOption} /></div>
              <div className="weekday-dropdown">
                <button
                  className="weekday-dropdown-trigger"
                  aria-expanded={dayFilterOpen}
                  aria-controls="recommended-day-options"
                  onClick={() => setDayFilterOpen((value) => !value)}
                >
                  {`曜日指定: ${selectedDays.length ? selectedDays.map((day) => days[day]).join("・") : "なし"}`}
                </button>
                {dayFilterOpen && (
                  <div
                    className="weekday-dropdown-panel"
                    id="recommended-day-options"
                    role="group"
                    aria-label="推奨曜日を複数選択"
                  >
                    <div className="weekday-actions"><button onClick={() => onPreferences({ ...preferences, days: [0, 1, 2, 3, 4, 5, 6] })}>全ON</button><button onClick={() => onPreferences({ ...preferences, days: [] })}>全OFF</button></div>
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
                )}
              </div>
              {recommendedEntries.length === 0 ? (
                <p className="week">選択した推奨曜日の項目はありません。</p>
              ) : (
                <div data-projection="planned">{sortEntries(recommendedEntries).map(renderEntry)}</div>
              )}
              {preferences.showCompleted && <div data-projection="actual">{selectedDayCompletedRows.map(renderCompleted)}</div>}
            </>
          )}
        </>
      )}
      <section className="load-summary" aria-label="トレーニング負荷">
        <h2>トレーニング負荷</h2>
        <div><span>今週の総トレーニング負荷</span><b>{Math.round(load.current).toLocaleString()} pt</b></div>
        <div><span>週の平均総トレーニング負荷</span><b>{load.average === undefined ? "データ不足" : `${Math.round(load.average).toLocaleString()} pt`}</b></div>
        <div><span>ACWR（目安：0.8〜1.3）</span><b>{load.acwr === undefined ? "データ不足" : load.acwr.toFixed(2)}</b></div>

      </section>
      </>}
    </Frame>
  );
}

function RunPage({
  completedSession,
  data,
  commit,
  entry,
  item,
  exercise,
  onBack,
  onComplete,
  onTop,
  onSettings,
}: {
  completedSession?: Session;
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  entry?: MenuEntry;
  item: TrainingItem;
  exercise: Exercise;
  onBack: () => void;
  onComplete: (session: ReturnType<typeof createCanonicalSession>) => Promise<boolean>;
  onTop: () => void;
  onSettings: () => void;
}) {
  const latest = completedSession;
  const done = !!completedSession;
  const [weight, setWeight] = useState(done ? latest!.weight ?? 0 : item.weight ?? 0);
  const [reps, setReps] = useState(done ? latest!.reps ?? 0 : item.reps ?? 0);
  const [seconds, setSeconds] = useState(done ? latest!.seconds ?? 0 : item.seconds ?? 0);
  const [sets, setSets] = useState(done ? latest!.sets : item.sets);
  const [seat, setSeat] = useState(done ? latest!.seat ?? "" : item.seat ?? "");
  const [memo, setMemo] = useState(done ? latest!.memo ?? "" : "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const pendingSession = useRef<Session | undefined>(undefined);
  const runAction = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try { await action(); } catch (error) { setMessage(`保存できません: ${String(error)}`); }
    finally { busy.current = false; setPending(false); }
  };
  const saveStandard = () => runAction(async () => {
    if (!confirm("この設定を標準設定として登録しますか？当回メモは標準設定へ保存しません。")) return;
    const updated = { ...item, weight: exercise.usesWeight ? weight : undefined, reps: exercise.measureType === "reps" ? reps : undefined, seconds: exercise.measureType === "time" ? seconds : undefined, sets, seat: seat || undefined };
    if (await commit(updateTrainingItem(data, updated, { newId: uid, now: () => new Date().toISOString() }))) {
      setMessage("");
    } else setMessage("標準設定を保存できません。入力値を確認してください。");
  });
  const cancel = () => runAction(async () => {
    if (!latest || !confirm(`${latest.date}の実行を取り消しますか？`)) return;
    if (await commit(cancelSession(data, latest.id))) onBack();
    else setMessage("実行を取り消せませんでした。");
  });
  const adjustWeight = (delta: number) =>
    setWeight((value) => Math.max(0, Math.round((value + delta) * 100) / 100));
  const complete = () => runAction(async () => {
    if (done) { onBack(); return; }
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
    if (!pendingSession.current) {
      const now = new Date();
      const performedAt = now.toISOString();
      const performedOrder = data.sessions.reduce((order, session) => compareInstants(session.performedAt, performedAt) === 0 ? Math.max(order, session.performedOrder + 1) : order, 0);
      pendingSession.current = createCanonicalSession({
        id: uid(),
        item,
        exercise,
        date: localDate(now),
        performedAt,
        performedOrder,
        weight: exercise.usesWeight ? weight : undefined,
        reps: exercise.measureType === "reps" ? reps : undefined,
        seconds: exercise.measureType === "time" ? seconds : undefined,
        sets,
        bodyWeight: data.profile.weight,
        seat: seat || undefined,
        memo: memo || undefined,
        menuEntryId: entry?.id,
      });
    }
    pendingSession.current = { ...pendingSession.current, weight: exercise.usesWeight ? weight : undefined, reps: exercise.measureType === "reps" ? reps : undefined, seconds: exercise.measureType === "time" ? seconds : undefined, sets, seat: seat || undefined, memo: memo || undefined };
    const saved = await onComplete(pendingSession.current);
    if (!saved) setMessage("実施記録を保存できませんでした。入力値と保存状態を確認してください。");
  });
  if (historyOpen) return (
    <Frame title="設定履歴" back={() => setHistoryOpen(false)} onTop={onTop} onSettings={onSettings}>
      <SettingHistory data={data} commit={commit} itemId={item.id} />
    </Frame>
  );
  return (
    <Frame title={completedSession?.snapshot.trainingItemDisplayName ?? item.displayName} back={pending ? undefined : onBack} onTop={pending ? () => {} : onTop} onSettings={onSettings}>
      {done && <p className="week">今週実施済み（{latest!.date}）</p>}
      {message && <p role="status">{message}</p>}
      {exercise.usesWeight && (
        <section className="run-weight">
          <span>重量</span>
          <div className="weight-controls">
            <button disabled={done || pending}
              aria-label="重量を1kg減らす"
              onClick={() => adjustWeight(-1)}
            >
              <strong>&lt;&lt;</strong>
            </button>
            <button disabled={done || pending}
              aria-label="重量を0.25kg減らす"
              onClick={() => adjustWeight(-0.25)}
            >
              &lt;
            </button>
            <b>{weight.toFixed(2)} kg</b>
            <button disabled={done || pending}
              aria-label="重量を0.25kg増やす"
              onClick={() => adjustWeight(0.25)}
            >
              &gt;
            </button>
            <button disabled={done || pending}
              aria-label="重量を1kg増やす"
              onClick={() => adjustWeight(1)}
            >
              <strong>&gt;&gt;</strong>
            </button>
          </div>
        </section>
      )}
      <div className="run-slot-grid">
        <section className="run-slot"><span>{exercise.measureType === "reps" ? "回数" : "時間（秒）"}</span><div>
          <button disabled={done || pending} aria-label={exercise.measureType === "reps" ? "回数を減らす" : "時間を減らす"} onClick={() => exercise.measureType === "reps" ? setReps(value => Math.max(1, value - 1)) : setSeconds(value => Math.max(10, value - 10))}>−</button>
          <b>{exercise.measureType === "reps" ? `${reps} 回` : `${seconds} 秒`}</b>
          <button disabled={done || pending} aria-label={exercise.measureType === "reps" ? "回数を増やす" : "時間を増やす"} onClick={() => exercise.measureType === "reps" ? setReps(value => value + 1) : setSeconds(value => value + 10)}>＋</button>
        </div></section>
        <section className="run-slot"><span>実施セット数</span><div><button disabled={done || pending} aria-label="セット数を減らす" onClick={() => setSets(value => Math.max(1, value - 1))}>−</button><b>{sets}</b><button disabled={done || pending} aria-label="セット数を増やす" onClick={() => setSets(value => value + 1)}>＋</button></div></section>
      </div>
      <button className="history-link" disabled={pending} onClick={() => setHistoryOpen(true)}>この実施項目の設定履歴を見る　›</button>
      <p className="run-meta">メモ1：<span>{item.standardMemo || "—"}</span></p>
      <label className="seat-inline">
        シート位置
        <input disabled={done || pending} value={seat} onChange={(event) => setSeat(event.target.value)} />
      </label>
      <label>
        今回メモ
        <textarea disabled={done || pending} value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>
      <button className="primary" disabled={pending} onClick={complete}>
        {done ? "戻る" : "種目を完了"}
      </button>
      <button className="save-setting" disabled={pending} onClick={saveStandard}>この設定を登録</button>
      {latest && <button className="save-setting danger" disabled={pending} onClick={cancel}>{Number(latest.date.slice(5, 7))}/{Number(latest.date.slice(8))}の実行を取り消す</button>}
      <TrainerManagementOff data={data} commit={commit} kind="trainingItems" id={item.id} />
    </Frame>
  );
}

function RegionWarning({ exercise, onEdit }: { exercise: Exercise; onEdit: (id: string) => void }) {
  if (exerciseBodyRegion(exercise)) return null;
  return <div className="region-warning" role="alert"><span>bodyRegion classification が不正です</span><button className="small" onClick={() => onEdit(exercise.id)}>編集</button></div>;
}

function ExtraPage({ data, onBack, onChoose, onEditExercise, onSettings, onTop }: { data: CanonicalAppData; onBack: () => void; onChoose: (id: string) => void; onEditExercise: (id: string) => void; onSettings: () => void; onTop: () => void }) {
  const [filter, setFilter] = useState("");
  const [excludeDays, setExcludeDays] = useState(0);
  const [option, setOption] = useState(false);
  const preferences = effectiveDisplayPreferences(data);
  const regions = bodyRegions({ ...data, exercises: active(data.exercises) });
  const excluded = excludeDays ? recentlyPerformedExercises(data.sessions, localDate(), excludeDays) : new Set<string>();
  const rows = sortDisplayRows(active(data.trainingItems).filter(item => data.exercises.some(exercise => exercise.id === item.exerciseId && exercise.lifecycle === "active" && (!filter || exerciseBodyRegion(exercise) === filter)) && !excluded.has(item.exerciseId)), item => ({ id: item.id, name: item.displayName, bodyRegion: exerciseBodyRegion(data.exercises.find(exercise => exercise.id === item.exerciseId)) }), preferences, option, ['bodyRegion']);
  return <Frame className="list-density-trial" title="追加トレーニング" back={onBack} onSettings={onSettings} onTop={onTop}>
    <p className="week">追加分は実施総数に含めます。週メニューへの登録は変更しません。</p>
    <div className="extra-filters"><select aria-label="部位" value={filter} onChange={event => setFilter(event.target.value)}><option value="">部位：すべて</option>{regions.map(value => <option key={value}>{value}</option>)}</select>
    <label>除外<select aria-label="除外" value={excludeDays} onChange={event => setExcludeDays(Number(event.target.value))}>{[0, 2, 4, 6, 10].map(value => <option key={value} value={value}>{value ? `直近${value}日` : "なし"}</option>)}</select></label></div>
    <OptionSort checked={option} onChange={setOption} />
    {rows.map(item => { const exercise = data.exercises.find(value => value.id === item.exerciseId)!; return <div key={item.id} data-training-item-id={item.id}><button className="row" onClick={() => onChoose(item.id)}><span><b>{exerciseBodyRegion(exercise) ?? ""}：{item.displayName}</b><small>{exercise.measureType === "reps" ? `${exercise.usesWeight ? `${item.weight ?? 0} kg × ` : ""}${item.reps ?? 0} 回` : `${item.seconds ?? 0} 秒`} × {item.sets} セット</small></span><span>›</span></button><RegionWarning exercise={exercise} onEdit={onEditExercise} /></div>; })}
  </Frame>;
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
    right.date.localeCompare(left.date) || compareInstants(right.performedAt, left.performedAt) || compareNames(left.snapshot.trainingItemDisplayName, right.snapshot.trainingItemDisplayName) || left.id.localeCompare(right.id),
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
  const height = 300;
  const left = 54;
  const top = 22;
  const right = 10;
  const bottom = 55;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const point = (value: number, index: number) => `${left + (innerWidth / Math.max(1, labels.length - 1)) * index},${top + innerHeight - (value / max) * innerHeight}`;
  return (
    <section className="chart" aria-label="分析グラフ">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="トレーニング推移グラフ">
        {[0, 0.5, 1].map((ratio) => (
          <line key={ratio} x1={left} x2={width - right} y1={top + innerHeight * ratio} y2={top + innerHeight * ratio} className="grid" />
        ))}
        <text x="2" y={top + 5}>{formatLoad(max)} {unit}</text>
        <text x="2" y={top + innerHeight / 2 + 5}>{formatLoad(max / 2)}</text>
        <text x="25" y={top + innerHeight}>0</text>
        {labels.map((label, index) => (
          <text key={`${label}-${index}`} className="axis" x={left + (innerWidth / Math.max(1, labels.length - 1)) * index} y={height - 16} textAnchor="middle">{label}</text>
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
  const [metric, setMetric] = useState<"weight" | "load">("weight");
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "half" | "year">("week");
  const [view, setView] = useState<"all" | "category" | "detail">("all");
  const [region, setRegion] = useState("");
  const [detail, setDetail] = useState<"body" | "exercise">("body");
  const periodStart = (date: Date) => analysisBucketStart(localDate(date), period, data.weekStartsOn);
  const starts = analysisBucketStarts({ nowDate: localDate(), period, weekStartsOn: data.weekStartsOn });
  const regions = [...new Set(data.sessions.flatMap(session => session.snapshot.classifications?.filter(value => value.kind === "bodyRegion").map(value => value.label) ?? []))].sort((a, b) => compareBodyRegions(a, b, effectiveDisplayPreferences(data).bodyRegionOrder));
  const selectedRegion = regions.includes(region) ? region : regions[0] ?? "";
  const seriesMap = new Map<string, AnalysisSeries>();
  const seriesFor = (id: string, name: string) => {
    if (!seriesMap.has(id)) seriesMap.set(id, { id, name, values: starts.map(() => 0) });
    return seriesMap.get(id)!;
  };
  if (view === "all") seriesFor("all", "全体");
  for (const session of data.sessions) {
    const bucket = starts.indexOf(periodStart(new Date(`${session.date}T12:00:00`)));
    if (bucket < 0) continue;
    const classification = session.snapshot.classifications?.find(value => value.kind === "bodyRegion")?.label;
    if (view === "detail" && classification !== selectedRegion) continue;
    const id = view === "all" ? "all" : view === "category" || detail === "body" ? classification ?? "unclassified-snapshot" : session.snapshot.exerciseId;
    const name = view === "all" ? "全体" : view === "category" || detail === "body" ? classification ?? "記録時の部位情報なし" : session.snapshot.exerciseName;
    const value = metric === "load" ? referenceTrainingLoad(session) : session.snapshot.measureType === "reps" ? (session.weight ?? 0) * (session.snapshot.weightMode === "perSide" ? 2 : 1) * (session.reps ?? 0) * session.sets : 0;
    seriesFor(id, name).values[bucket] += value;
  }
  const labels = starts.map((start, index) => {
    if (index === 11) return period === "week" ? "今週（途中）" : period === "month" ? "今月（途中）" : "今期（途中）";
    const date = new Date(`${start}T12:00:00`), year = date.getFullYear(), month = date.getMonth() + 1;
    return period === "week" ? `${month}/${date.getDate()}` : period === "month" ? `${year}/${month}` : period === "quarter" ? `${year} Q${Math.ceil(month / 3)}` : period === "half" ? `${year} ${month <= 6 ? "上" : "下"}` : `${year}`;
  });
  return <Frame outerHeader title="分析" back={onBack} onSettings={onSettings} onTop={onTop}>
    <label>集計<select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="weight">実施総重量</option><option value="load">総トレーニング負荷（参考）</option></select></label>
    <label>期間<select value={period} onChange={event => setPeriod(event.target.value as typeof period)}><option value="week">週</option><option value="month">月</option><option value="quarter">四半期</option><option value="half">半年</option><option value="year">年</option></select></label>
    <label>表示<select value={view} onChange={event => setView(event.target.value as typeof view)}><option value="all">全体</option><option value="category">部位別</option><option value="detail">部位詳細</option></select></label>
    {view === "detail" && <><label>部位<select value={selectedRegion} onChange={event => setRegion(event.target.value)}>{regions.map(value => <option key={value}>{value}</option>)}</select></label><label>内訳<select value={detail} onChange={event => setDetail(event.target.value as typeof detail)}><option value="body">部位別</option><option value="exercise">種目別</option></select></label></>}
    <AnalysisChart series={view === "category" ? [...seriesMap.values()].sort((a, b) => compareBodyRegions(a.name, b.name, effectiveDisplayPreferences(data).bodyRegionOrder)) : [...seriesMap.values()]} labels={labels} unit={metric === "weight" ? "kg" : "pt"} />
  </Frame>;
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
  const [proposalMessage, setProposalMessage] = useState("");
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
    setProposalMessage("");
  };
  const downloadProposal = () => {
    if (!mappings) return;
    const result = createAndroidManMenuProposal(data, mappings, { includeTime: includeFrontPlank, newId: uid });
    if (!result.ok) {
      setErrors(result.errors.map((value) => `${value.path}: ${value.message}`));
      setProposalMessage("");
      return;
    }
    downloadJson(`android-man-menu-proposal-${localDate()}.json`, result.proposal);
    setErrors([]);
    setProposalMessage(`Android MAN用のメニュー提案JSONを作成しました。既存の「メニュー投入」から選択してください。${result.warnings.length ? " 推奨曜日未指定の確認が表示されます。" : ""}`);
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
          {errors.map((error) => <p className="week danger" key={error}>{error}</p>)}
          <button className="primary" onClick={downloadProposal}>MAN用メニューJSONを作成</button>
          {proposalMessage && <p className="week">{proposalMessage}</p>}
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

function SettingsPage(props: SettingsPageProps) {
  const { data, commit, onTop, onBackup, onMenuImport, onAnalysis } = props;
  const [route, setRoute] = useState<SettingsTab | undefined>(props.exerciseEditId ? "exercise" : props.menuToInspectId ? "menu" : undefined);
  const [edit, setEdit] = useState<string | null | undefined>(props.exerciseEditId ?? props.menuToInspectId);
  const [option, setOption] = useState(false);
  const [preset, setPreset] = useState<string>();
  const [menuHidden, setMenuHidden] = useState(false);
  const listKey = route === "item" ? "item" : "exercise";
  const filter = props.listPreferences[listKey].filter;
  const hidden = route === "menu" ? menuHidden : props.listPreferences[listKey].hidden;
  const setFilter = (filter: string) => props.onListPreferences({ ...props.listPreferences, [listKey]: { ...props.listPreferences[listKey], filter } });
  const setHidden = (hidden: boolean) => route === "menu" ? setMenuHidden(hidden) : props.onListPreferences({ ...props.listPreferences, [listKey]: { ...props.listPreferences[listKey], hidden } });
  const [historyItem, setHistoryItem] = useState("");
  const [historyRegion, setHistoryRegion] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const region = (exerciseId: string) => exerciseBodyRegion(data.exercises.find(value => value.id === exerciseId));
  const regions = bodyRegions(data);
  const preferences = effectiveDisplayPreferences(data);
  const sorted = <T,>(rows: T[], id: (row: T) => string, name: (row: T) => string, exerciseId: (row: T) => string) => sortDisplayRows(rows, row => ({ id: id(row), name: name(row), bodyRegion: region(exerciseId(row)) }), preferences, option, ['bodyRegion']);
  const editExercise = (id: string) => { setRoute("exercise"); setEdit(id); setOption(false); };
  const root = () => { setOption(false); setRoute(undefined); setEdit(undefined); setHistoryOpen(false); };
  const list = () => { setOption(false); setEdit(undefined); setPreset(undefined); if (route === "menu") setMenuHidden(false); };
  const labels = { profile: "プロフィール", exercise: "種目", item: "実施項目", menu: "週メニュー", settingHistory: "設定履歴", displayPreferences: "表示設定" };
  const title = !route ? "設定" : edit !== undefined ? `${labels[route]}を${edit === null ? "登録" : "編集"}` : labels[route];
  const navigate = (next: SettingsTab) => { setOption(false); setRoute(next); setEdit(undefined); if (next === "menu") setMenuHidden(false); if (next === "settingHistory") { setHistoryItem(""); setHistoryRegion(""); setHistoryOpen(false); } };
  const row = (name: string, sub: string, action: () => void) => <button className={`row ${edit === undefined && (route === "exercise" || route === "item") ? "settings-list-v11" : ""}`} key={name} title={sub} onClick={action}><span>{edit === undefined && (route === "exercise" || route === "item") ? <><small>{sub.split("　")[0]}</small><b>{name}</b></> : <><b>{name}</b><small>{sub}</small></>}</span><span>›</span></button>;
  const archiveExercise = async (value: Exercise) => { if (value.lifecycle === "active" && !confirm("この種目を非表示にしますか？")) return; if (await commit({ ...data, exercises: data.exercises.map(candidate => candidate.id === value.id ? { ...candidate, lifecycle: value.lifecycle === "active" ? "archived" : "active" } : candidate) })) list(); };
  const archiveItem = async (value: TrainingItem) => { if (value.lifecycle === "active" && !confirm("この実施項目を非表示にしますか？")) return; if (await commit({ ...data, trainingItems: data.trainingItems.map(candidate => candidate.id === value.id ? { ...candidate, lifecycle: value.lifecycle === "active" ? "archived" : "active" } : candidate) })) list(); };
  return <Frame outerHeader={!!route && !historyOpen} title={title} back={!route ? undefined : historyOpen ? () => setHistoryOpen(false) : edit !== undefined ? list : root} onSettings={root} onTop={onTop}>
    {props.notice && <p role="alert">{props.notice}</p>}
    {!route ? <>
      {import.meta.env.DEV && <button className="save-setting" onClick={props.onMasterBootstrap}>MAN用マスターを投入</button>}
      {row("プロフィール", "体重・身長・年齢・性別", () => navigate("profile"))}
      {row("種目", "種目名・部位・回数／時間・重量の扱い", () => navigate("exercise"))}
      {row("実施項目", "重量・回数／時間・セット数などの標準設定", () => navigate("item"))}
      {row("週メニュー", "実施項目と推奨曜日の組み合わせ", () => navigate("menu"))}
      {row("表示設定", "", () => navigate("displayPreferences"))}
      {row("分析", "トレーニング負荷の推移", onAnalysis)}
      {row("設定履歴", "実施項目ごとの過去設定", () => navigate("settingHistory"))}
      {row("データ管理", "バックアップ作成・復元", onBackup)}
      {row("トレーナー連携", "メニュー提案の取り込み・履歴の出力", onMenuImport)}
      <p className="meta" aria-label="ビルド識別子">{buildIdentifier}</p>
    </> : route === "displayPreferences" ? <DisplayPreferencesEditor data={data} commit={commit} onSaved={root} /> : route === "profile" ? <ProfileEditor data={data} commit={commit} onSaved={root} /> : route === "settingHistory" ? historyOpen ? <SettingHistory data={data} commit={commit} itemId={historyItem} /> : <>
      <label>部位<select value={historyRegion} onChange={event => { setHistoryRegion(event.target.value); setHistoryItem(""); }}><option value="">選択してください</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>実施項目<select value={historyItem} onChange={event => setHistoryItem(event.target.value)}><option value="">選択してください</option>{active(data.trainingItems).filter(value => !historyRegion || region(value.exerciseId) === historyRegion).sort((a, b) => compareNames(a.displayName, b.displayName) || a.id.localeCompare(b.id)).map(value => <option key={value.id} value={value.id}>{value.displayName}</option>)}</select></label>
      {historyItem && <RegionWarning exercise={data.exercises.find(exercise => exercise.id === data.trainingItems.find(item => item.id === historyItem)?.exerciseId)!} onEdit={editExercise} />}
      {historyItem && <button className="primary" onClick={() => setHistoryOpen(true)}>設定履歴を見る</button>}
    </> : route === "menu" ? edit !== undefined ? <MenuEditor key={edit ?? "new"} data={data} commit={commit} menuId={edit} onSaved={list} onEditExercise={editExercise} /> : <>
      <label className="check"><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} />非表示データを表示</label>
      {data.menus.filter(value => hidden ? value.lifecycle === "archived" : value.lifecycle === "active").sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id)).map(value => row(`${value.name}${value.id === data.activeMenuId ? "（使用中）" : ""}`, `${data.menuEntries.filter(entry => entry.menuId === value.id && entry.lifecycle === "active").length}項目`, () => setEdit(value.id)))}
      <button className="primary" onClick={() => setEdit(null)}>＋ 週メニューを登録</button>
    </> : edit !== undefined ? route === "exercise" ? <>
      <ExerciseEditor key={edit ?? "new"} initialExercise={data.exercises.find(value => value.id === edit)} onSaved={list} data={data} commit={commit} onConfigure={id => { setPreset(id); setRoute("item"); setEdit(null); }} />
      {edit && <button className="archive" onClick={() => archiveExercise(data.exercises.find(value => value.id === edit)!)}>{data.exercises.find(value => value.id === edit)?.lifecycle === "active" ? "この種目を非表示にする" : "再表示する"}</button>}
    </> : <>
      <ItemEditor key={`${edit}:${preset}`} data={data} commit={commit} itemId={edit} presetExerciseId={preset} onSaved={list} />
      {edit && <button className="archive" onClick={() => archiveItem(data.trainingItems.find(value => value.id === edit)!)}>{data.trainingItems.find(value => value.id === edit)?.lifecycle === "active" ? "この実施項目を非表示にする" : "再表示する"}</button>}
    </> : <>
      <select aria-label="部位" value={filter} onChange={event => setFilter(event.target.value)}><option value="">部位：すべて</option>{regions.map(value => <option key={value}>{value}</option>)}</select>
      <div className="list-checks"><label className="check"><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} />非表示データを表示</label><OptionSort checked={option} onChange={setOption} /></div>
      {route === "exercise" ? sorted(data.exercises.filter(value => (hidden ? value.lifecycle === "archived" : value.lifecycle === "active") && (!filter || region(value.id) === filter)), value => value.id, value => value.name, value => value.id).map(value => <div key={value.id}>{row(value.name, `${region(value.id) ?? ""}　${value.measureType === "reps" ? "回数型" : "時間型"}${value.usesWeight ? value.weightMode === "perSide" ? "　片側×2" : "　合計×1" : ""}`, () => setEdit(value.id))}<RegionWarning exercise={value} onEdit={editExercise} /></div>) : sorted(data.trainingItems.filter(value => (hidden ? value.lifecycle === "archived" : value.lifecycle === "active") && (!filter || region(value.exerciseId) === filter)), value => value.id, value => value.displayName, value => value.exerciseId).map(value => <div key={value.id}>{row(value.displayName, region(value.exerciseId) ?? "", () => setEdit(value.id))}<RegionWarning exercise={data.exercises.find(exercise => exercise.id === value.exerciseId)!} onEdit={editExercise} /></div>)}
      <button className="primary" onClick={() => setEdit(null)}>＋ {labels[route]}を登録</button>
    </>}
  </Frame>;
}

function MenuEditor({ data, commit, menuId, onSaved, onEditExercise }: { onEditExercise: (id: string) => void; data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean>; menuId: string | null; onSaved: () => void }) {
  const [menu, setMenu] = useState<Menu>(() => clone(data.menus.find(value => value.id === menuId) ?? { id: uid(), lifecycle: "active", name: "", managementMode: "MAN" }));
  const [entries, setEntries] = useState(() => clone(data.menuEntries.filter(entry => entry.menuId === menuId)));
  const [filter, setFilter] = useState("");
  const [option, setOption] = useState(false);
  const regions = bodyRegions(data);
  const preferences = effectiveDisplayPreferences(data);
  const projectItem = (item: TrainingItem) => ({ id: item.id, name: item.displayName, bodyRegion: exerciseBodyRegion(data.exercises.find(exercise => exercise.id === item.exerciseId)) });
  const activeEntries = sortDisplayRows(entries.filter(entry => entry.lifecycle === "active"), entry => ({ ...projectItem(data.trainingItems.find(item => item.id === entry.trainingItemId)!), id: entry.id, recommendedDay: entry.recommendedDay }), preferences, option, ['recommendedDay', 'bodyRegion']);
  const save = async () => {
    if (!menu.name.trim()) return;
    const next = { ...data, menus: data.menus.some(value => value.id === menu.id) ? data.menus.map(value => value.id === menu.id ? { ...menu, managementMode: value.managementMode, name: menu.name.trim() } : value) : [...data.menus, { ...menu, name: menu.name.trim() }], menuEntries: [...data.menuEntries.filter(entry => entry.menuId !== menu.id), ...entries] };
    if (await commit(next)) onSaved();
  };
  const regionOf = (item: TrainingItem) => exerciseBodyRegion(data.exercises.find(value => value.id === item.exerciseId)) ?? "";
  const describe = (item: TrainingItem) => {
    const exercise = data.exercises.find(value => value.id === item.exerciseId)!;
    return exercise.measureType === "time" ? `${item.seconds ?? 0}秒 × ${item.sets}セット` : `${exercise.usesWeight ? `${item.weight ?? 0}kg × ` : ""}${item.reps ?? 0}回 × ${item.sets}セット`;
  };
  const archive = async () => {
    if (menu.lifecycle === "active" && !confirm("この週メニューを非表示にしますか？")) return;
    if (await commit({ ...data, menus: data.menus.map(value => value.id === menu.id ? { ...value, lifecycle: value.lifecycle === "active" ? "archived" : "active" } : value) })) onSaved();
  };
  return <>
    <label>週メニュー名<input value={menu.name} onChange={event => setMenu({ ...menu, name: event.target.value })} /></label>
    <label>メモ<textarea value={menu.memo ?? ""} onChange={event => setMenu({ ...menu, memo: event.target.value || undefined })} /></label>
    <h2>実施項目と推奨曜日</h2>
    <OptionSort checked={option} onChange={setOption} />
    {activeEntries.map(entry => {
      const item = data.trainingItems.find(item => item.id === entry.trainingItemId)!;
      return <div key={entry.id} data-menu-entry-id={entry.id}><div className="row static compact"><span><b>{regionOf(item)}：{item.displayName}</b><small>{describe(item)}</small></span>
        <select className="day-select" aria-label="推奨曜日" value={entry.recommendedDay ?? ""} onChange={event => setEntries(entries.map(value => value.id === entry.id ? { ...value, recommendedDay: event.target.value === "" ? undefined : Number(event.target.value) as RecommendedDay } : value))}><option value="">任意</option>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select>
        <button className="small danger" onClick={() => { if (confirm("この実施項目を週メニューから外しますか？")) setEntries(entries.map(value => value.id === entry.id ? { ...value, lifecycle: "archived" } : value)); }}>外す</button></div><RegionWarning exercise={data.exercises.find(exercise => exercise.id === item.exerciseId)!} onEdit={onEditExercise} /></div>;
    })}
    <h2>実施項目を追加</h2>
    <select aria-label="追加候補の部位" value={filter} onChange={event => setFilter(event.target.value)}><option value="">すべて</option>{regions.map(value => <option key={value}>{value}</option>)}</select>
    {sortDisplayRows(active(data.trainingItems).filter(item => data.exercises.some(exercise => exercise.id === item.exerciseId && exercise.lifecycle === "active" && (!filter || exerciseBodyRegion(exercise) === filter))), projectItem, preferences, option, ['bodyRegion']).map(item => <div key={item.id} data-candidate-item-id={item.id}><div className="row static"><span><b>{item.displayName}</b><small>{describe(item)}</small></span><button className="small" onClick={() => { if (confirm(`「${item.displayName}」を週メニューに追加しますか？`)) setEntries([...entries, { id: uid(), lifecycle: "active", menuId: menu.id, trainingItemId: item.id, order: Math.max(-1, ...entries.filter(entry => entry.lifecycle === "active").map(entry => entry.order)) + 1 }]); }}>追加</button></div><RegionWarning exercise={data.exercises.find(exercise => exercise.id === item.exerciseId)!} onEdit={onEditExercise} /></div>)}
    <button className="primary" disabled={!menu.name.trim()} onClick={save}>保存</button>
    {menuId && <button className={menu.lifecycle === "active" ? "archive" : "primary"} disabled={menu.id === data.activeMenuId} onClick={archive}>{menu.lifecycle === "archived" ? "再表示する" : menu.id === data.activeMenuId ? "使用中の週メニューは非表示にできません" : "この週メニューを非表示にする"}</button>}
    {menuId && <TrainerManagementOff data={data} commit={commit} kind="menus" id={menuId} />}
  </>;
}

type SettingsPageProps = {
  listPreferences: ListPreferences;
  onListPreferences: (preferences: ListPreferences) => void;
  notice?: string;
  data: CanonicalAppData;
  itemEditId?: string | null;
  onEditItem: (id: string | null) => void;
  onItemList: () => void;
  onBackup: () => void;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  itemPresetExerciseId?: string;
  onConfigureExercise: (exerciseId: string) => void;
  onMenuImport: () => void;
  onTrainerHistoryExport: () => void;
  onAnalysis: () => void;
  onMasterBootstrap: () => void;
  exerciseEditId?: string;
  menuToInspectId?: string;
  onBack: () => void;
  onSettings: () => void;
  onTop: () => void;
};

function ProfileEditor({
  data,
  commit,
  onSaved,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  onSaved?: () => void;
}) {
  const [profile, setProfile] = useState(data.profile);
  return (
    <>
      <label>
        体重（kg）
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={profile.weight}
          onChange={(event) =>
            setProfile({ ...profile, weight: Number(event.target.value) })
          }
        />
        <small>実行時の体重を履歴へ保存し、参考負荷の計算に使います。</small>
      </label>
      <label>
        身長（cm）
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
          onChange={(event) => { if (confirm("週の開始曜日を変更すると、過去を含む週集計・分析・実施状況の区切りが変わります。実施記録自体は変更しません。変更しますか？")) void commit({ ...data, weekStartsOn: Number(event.target.value) as RecommendedDay }); }}
        >
          {days.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" onClick={async () => { if (await commit({ ...data, profile })) onSaved?.(); }}>
        保存
      </button>
    </>
  );
}
function ExerciseEditor({
  data,
  commit,
  onConfigure,
  initialExercise,
  onSaved,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  onConfigure: (exerciseId: string) => void;
  initialExercise?: Exercise;
  onSaved?: () => void;
}) {
  const bodyRegionOf = (exercise: Exercise) =>
    exerciseBodyRegion(exercise) ?? "";
  const choiceFor = (label: string): BodyRegionChoice =>
    !label ? "unset" : standardBodyRegions.includes(label as (typeof standardBodyRegions)[number]) ? label as (typeof standardBodyRegions)[number] : "custom";
  const blank = (): Exercise => ({
    id: uid(),
    lifecycle: "active",
    name: "",
    measureType: "reps",
    usesWeight: true,
    weightMode: "total",
    classifications: [],
  });
  const [form, setForm] = useState<Exercise>(() => initialExercise ? clone(initialExercise) : blank());
  const initialLabel = initialExercise ? bodyRegionOf(initialExercise) : "";
  const [bodyRegionChoice, setBodyRegionChoice] = useState<BodyRegionChoice>(choiceFor(initialLabel));
  const [customBodyRegion, setCustomBodyRegion] = useState(choiceFor(initialLabel) === "custom" ? initialLabel : "");
  const save = async (configure = false) => {
    if (!form.name.trim() || !bodyRegionOf(form).trim()) return;
    const next = {
      ...form,
      name: form.name.trim(),
      weightMode: form.usesWeight ? (form.weightMode ?? "total") : undefined,
      classifications: form.classifications?.filter(value => value.label.trim()),
    };
    const exists = data.exercises.some((value) => value.id === next.id);
    if (
      await commit({
        ...data,
        exercises: exists
          ? data.exercises.map((value) => (value.id === next.id ? next : value))
          : [...data.exercises, next],
      })
    ) {
      setForm(blank());
      setBodyRegionChoice("unset");
      setCustomBodyRegion("");
      if (configure && !exists) onConfigure(next.id);
      else onSaved?.();
    }
  };
  return (
    <>
      <>
        <label>
          種目名
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label>
          部位
          <select
            aria-label="部位"
            value={bodyRegionChoice}
            onChange={(event) => {
              const choice = event.target.value as BodyRegionChoice;
              setBodyRegionChoice(choice);
              setCustomBodyRegion("");
              setForm({
                ...form,
                classifications:
                  choice === "unset" || choice === "custom"
                    ? []
                    : [{ kind: "bodyRegion", label: choice }],
              });
            }}
          >
            <option value="unset" disabled>選択してください</option>
            {[...standardBodyRegions].sort((a, b) => compareBodyRegions(a, b, effectiveDisplayPreferences(data).bodyRegionOrder)).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
            <option value="custom">その他 / カスタム</option>
          </select>
        </label>
        {bodyRegionChoice === "custom" && (
          <label>
            カスタム部位
            <input
              value={customBodyRegion}
              onChange={(event) => {
                const label = event.target.value;
                setCustomBodyRegion(label);
                setForm({
                  ...form,
                  classifications: label.trim()
                    ? [{ kind: "bodyRegion", label }]
                    : [],
                });
              }}
            />
          </label>
        )}
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
          <label className="check">
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
              <option value="perSide">片側重量・左右実施（×2）</option>
            </select>
          </label>
        )}

        {form.measureType === "reps" && <label>自重換算係数（%）<input type="number" min="0" value={form.selfWeightRatio ?? 0} onChange={event => setForm({ ...form, selfWeightRatio: Number(event.target.value) })} /><small>総トレーニング負荷（参考）のみで使います。</small></label>}
        {form.measureType === "time" && <label>秒間負荷係数（%）<input type="number" min="0" value={form.secondsLoadRatio ?? 0} onChange={event => setForm({ ...form, secondsLoadRatio: Number(event.target.value) })} /><small>体重 × 係数 × 秒数で参考負荷に換算します。</small></label>}
        {data.exercises.some((value) => value.id === form.id) ? (
          <button className="primary" disabled={!form.name.trim() || !bodyRegionOf(form).trim()} onClick={() => save()}>
            保存
          </button>
        ) : (
          <>
            <button className="primary" disabled={!form.name.trim() || !bodyRegionOf(form).trim()} onClick={() => save(true)}>
              保存して実施項目を設定
            </button>
            <button className="save-setting" disabled={!form.name.trim() || !bodyRegionOf(form).trim()} onClick={() => save()}>
              種目だけ保存
            </button>
          </>
        )}
      </>
      {!onSaved && active(data.exercises).sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id)).map((value) => (
        <button
          className="row"
          key={value.id}
          onClick={() => {
            const next = clone(value);
            const label = bodyRegionOf(next);
            setForm(next);
            setBodyRegionChoice(choiceFor(label));
            setCustomBodyRegion(choiceFor(label) === "custom" ? label : "");
          }}
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
  presetExerciseId, itemId, onSaved,
}: {
  data: CanonicalAppData;
  commit: (next: CanonicalAppData) => Promise<boolean>;
  presetExerciseId?: string;
  itemId: string | null;
  onSaved: () => void;
}) {
  const exercises = active(data.exercises);
  const presetExercise = exercises.find((value) => value.id === presetExerciseId);
  const initial = (): TrainingItem => ({
    managementMode: "MAN",
    id: uid(),
    lifecycle: "active",
    exerciseId: presetExercise?.id ?? exercises[0]?.id ?? "",
    displayName: presetExercise?.name ?? "",
    weight: 0,
    reps: 0,
    seconds: 0,
    sets: 0,
  });
  const [form, setFormState] = useState<TrainingItem>(() => clone(data.trainingItems.find(item => item.id === itemId) ?? initial()));
  const [errors, setErrors] = useState<string[]>([]);
  const setForm = (next: TrainingItem) => { setFormState(next); setErrors([]); };
  const [changeReason, setChangeReason] = useState("");
  const selected = exercises.find((value) => value.id === form.exerciseId);
  const exists = data.trainingItems.some((value) => value.id === form.id);
  const save = async () => {
    if (!selected || !form.displayName.trim()) return;
    const normalized: TrainingItem = {
      ...form,
      managementMode: data.trainingItems.find(value => value.id === form.id)?.managementMode ?? "MAN",
      displayName: form.displayName.trim(),
      weight: selected.usesWeight ? (form.weight ?? 0) : undefined,
      reps: selected.measureType === "reps" ? (form.reps ?? 0) : undefined,
      seconds:
        selected.measureType === "time" ? (form.seconds ?? 0) : undefined,
      sets: form.sets,
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
    const validation = validateCanonical(next);
    if (validation.errors.length) {
      setErrors(itemValidationMessages(validation.errors));
      return;
    }
    setErrors([]);
    if (await commit(next)) {
      onSaved();
    }
  };
  return (
    <>

      {exercises.length === 0 ? (
        <p className="week">先に種目を登録してください。</p>
      ) : (
        <>
          {errors.length > 0 && <div role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}
          <label>
            表示名
            <input
              placeholder={selected?.name || "種目を選択"}
              value={form.displayName}
              onChange={(event) =>
                setForm({ ...form, displayName: event.target.value })
              }
            />
            <small>同じ名称でも登録できます。</small>
          </label>
          <label>
            元にする種目
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
                      ? (form.reps ?? 0)
                      : undefined,
                  seconds:
                    exercise?.measureType === "time"
                      ? (form.seconds ?? 0)
                      : undefined,
                  weight: exercise?.usesWeight ? (form.weight ?? 0) : undefined,
                });
              }}
            >
              {[...exercises].sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id)).map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
          </label>
          {selected?.usesWeight && (
            <label>
              重量（kg）
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
              回数
              <input
                type="number"
                min="1"
                value={form.reps ?? 0}
                onChange={(event) =>
                  setForm({ ...form, reps: Number(event.target.value) })
                }
              />
            </label>
          ) : (
            <label>
              時間（秒）
              <input
                type="number"
                min="1"
                value={form.seconds ?? 0}
                onChange={(event) =>
                  setForm({ ...form, seconds: Number(event.target.value) })
                }
              />
            </label>
          )}
          <label>
            セット数
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
            シートのピン位置
            <input
              value={form.seat ?? ""}
              onChange={(event) =>
                setForm({ ...form, seat: event.target.value || undefined })
              }
            />
          </label>
          <label>
            メモ1（長期用）
            <textarea
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
          <button className="primary" disabled={!selected || !form.displayName.trim()} onClick={save}>
            保存
          </button>
          {exists && <TrainerManagementOff data={data} commit={commit} kind="trainingItems" id={form.id} />}
        </>
      )}
    </>
  );
}
function SettingHistory({ data, commit, itemId }: { data: CanonicalAppData; commit: (next: CanonicalAppData) => Promise<boolean>; itemId?: string }) {
  const rows = [...data.trainingItemSettingChanges].filter(change => !itemId || change.trainingItemId === itemId).sort((a, b) => compareInstants(b.changedAt, a.changedAt) || compareNames(data.trainingItems.find(item => item.id === a.trainingItemId)?.displayName ?? "", data.trainingItems.find(item => item.id === b.trainingItemId)?.displayName ?? "") || a.id.localeCompare(b.id));
  const remove = async (id: string, trainingItemId: string) => {
    if (!confirm("この設定変更履歴を削除しますか？")) return;
    await commit(deleteTrainingItemSettingChange(data, trainingItemId, id));
  };
  return <section className="setting-history-v11">
    <h2 className="setting-history-title">{data.trainingItems.find(item => item.id === itemId)?.displayName}</h2>
    {rows.length === 0 ? <p className="week">まだ設定変更はありません。</p> : rows.map(change => {
      const item = data.trainingItems.find(value => value.id === change.trainingItemId);
      const exercise = data.exercises.find(value => value.id === item?.exerciseId);
      const time = exercise?.measureType === "time";
      const values = time ? [["時間", change.snapshot.seconds, "秒"], ["回数", undefined, ""], ["セット数", change.snapshot.sets, "セット"]] : [["重量", change.snapshot.weight, "kg"], ["回数", change.snapshot.reps, "回"], ["セット数", change.snapshot.sets, "セット"]];
      return <article className="setting-history-row" key={change.id}>
        {!itemId && <b>{item?.displayName}</b>}
        <div className="setting-history-date"><time>{localDate(new Date(change.changedAt))}</time>{change.isInitial && <span>初回設定</span>}</div>
        <div className={`setting-history-values ${change.isInitial ? "initial" : ""}`}>
          <div className="setting-history-metrics">{values.map(([label, value, unit]) => <div key={String(label)}><small>{label}</small><strong>{value ?? "—"}<small>{value === undefined ? "" : unit}</small></strong></div>)}</div>
          {!change.isInitial && <button className="small danger" onClick={() => remove(change.id, change.trainingItemId)}>削除</button>}
        </div>
        <div className="setting-history-bottom"><span>シート位置：{change.snapshot.seat || "—"}</span>{change.isInitial && <small>初回設定（削除できません）</small>}</div>
        {change.changeReason && <small>変更理由: {change.changeReason}</small>}
      </article>;
    })}
  </section>;
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

function BackupPage({ data, onApplied, onBack, onSettings, onTop }: {
  data: CanonicalAppData;
  onApplied: (next: CanonicalAppData) => void;
  onBack: () => void;
  onSettings: () => void;
  onTop: () => void;
}) {
  const [preview, setPreview] = useState<BackupPreview>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const readGeneration = useRef(0);
  const read = async (file?: File) => {
    const generation = ++readGeneration.current;
    setPreview(undefined); setAcknowledged(false); setMessage("");
    if (!file) return;
    try {
      const raw = await file.text();
      if (readGeneration.current === generation) setPreview(previewCanonicalRestore(raw));
    } catch {
      if (readGeneration.current === generation) setPreview({ errors: [{ path: "file", message: "ファイルを読み込めませんでした" }], warnings: [] });
    }
  };
  const restore = async () => {
    if (busy.current || !preview?.envelope || preview.errors.length || (preview.warnings.length && !acknowledged)) return;
    if (!confirm("現在の正規データ全体を、このバックアップの内容で置き換えます。復元しますか？")) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const result = await applyCanonicalRestore(canonicalStorage, preview.envelope, acknowledged);
      if (!result.ok) {
        setUncertain(true);
        setMessage(`復元の成功を確認できません。${result.diagnostics.map(row => `${row.stage}: ${row.message}`).join(" / ")}`);
        return;
      }
      onApplied(result.value); setUncertain(false); setPreview(undefined);
      setMessage("復元しました。保存後の読み戻し一致を確認しました。");
    } catch (error) {
      setUncertain(true); setMessage(`復元の成功を確認できません: ${String(error)}`);
    } finally { busy.current = false; setPending(false); }
  };
  const locked = pending || uncertain;
  return (
    <Frame title="データ管理" back={locked ? undefined : onBack} onSettings={locked ? undefined : onSettings} onTop={locked ? () => {} : onTop}>
      {!uncertain && <section className="card">
        <h2>正規データのバックアップ</h2>
        <p>プロフィール・種目・実施項目・メニュー・実施履歴・設定履歴を含む全データを保存します。</p>
        <button className="primary" disabled={pending} onClick={() => {
          try { downloadJson(`training-check-backup-${localDate()}.json`, createCanonicalBackup(data, new Date().toISOString())); setMessage("バックアップを作成しました。"); }
          catch (error) { setMessage(`出力できません: ${String(error)}`); }
        }}>バックアップを作成</button>
      </section>}
      <section className="card">
        <h2>バックアップから復元</h2>
        <p>復元すると全データを置き換えます。メニュー提案・履歴出力・旧形式のJSONは復元できません。</p>
        <label>正規バックアップを選択<input disabled={pending} type="file" accept="application/json,.json" onChange={event => void read(event.target.files?.[0])} /></label>
      </section>
      {preview && preview.errors.length > 0 && <section className="card"><h2>復元できません</h2>{formatIssues(preview.errors)}</section>}
      {preview?.envelope && <section className="card">
        <h2>復元内容の確認</h2>
        <p>バックアップ作成日時: {preview.envelope.createdAt}</p>
        <p>種目 {preview.envelope.payload.exercises.length}件 / 実施項目 {preview.envelope.payload.trainingItems.length}件 / メニュー {preview.envelope.payload.menus.length}件 / メニュー内項目 {preview.envelope.payload.menuEntries.length}件</p>
        <p>実施履歴 {preview.envelope.payload.sessions.length}件 / 設定履歴 {preview.envelope.payload.trainingItemSettingChanges.length}件</p>
        <p>体重 {preview.envelope.payload.profile.weight} kg / 週開始 {days[preview.envelope.payload.weekStartsOn]}曜日</p>
        <DisplayPreferencesSummary data={preview.envelope.payload} />
        <p>{uncertain ? "保存成否は未確認です。この内容で復元を再実行する場合も確認が必要です。" : "まだ復元していません。現在のデータを残す場合は、先にバックアップを作成してください。"}</p>
        {preview.warnings.length > 0 && <><h3>確認が必要な項目</h3>{formatIssues(preview.warnings)}
          <label className="check"><input type="checkbox" disabled={pending} checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />警告内容を確認しました</label></>}
        <button className="primary" disabled={pending || (preview.warnings.length > 0 && !acknowledged)} onClick={restore}>全データを置き換えて復元</button>
      </section>}
      {message && <p role="status">{message}</p>}
      {uncertain && <section className="card" role="alert">
        <p>保存先が変わった可能性があるため、この画面から通常編集へ戻れません。再読込して保存状態を確認するか、バックアップから復元を再実行してください。旧データへは自動復帰しません。</p>
        <button className="primary" disabled={pending} onClick={() => window.location.reload()}>保存状態を再読込</button>
      </section>}
    </Frame>
  );
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
