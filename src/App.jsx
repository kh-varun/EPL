import { useEffect, useMemo, useState } from "react";
import LastUpdated from "./components/LastUpdated.jsx";
import Section from "./components/Section.jsx";
import TabBar from "./components/TabBar.jsx";
import StandingsTable from "./components/StandingsTable.jsx";
import MatchRow from "./components/MatchRow.jsx";
import Headlines from "./components/Headlines.jsx";
import TeamDetail from "./components/TeamDetail.jsx";
import MatchOddsDialog from "./components/MatchOddsDialog.jsx";
import MatchStatsDialog from "./components/MatchStatsDialog.jsx";
import { TrophyIcon, CalendarIcon, WhistleIcon, NewspaperIcon } from "./components/icons.jsx";

const TABS = [
  { id: "standings", label: "Table", icon: TrophyIcon },
  { id: "fixtures", label: "Fixtures", icon: CalendarIcon },
  { id: "results", label: "Results", icon: WhistleIcon },
  { id: "headlines", label: "News", icon: NewspaperIcon },
];

// Overlays a match with its live score/status when one's in progress -
// live-scores.json only ever holds entries for matches currently IN_PLAY
// or PAUSED, so any hit here is real live data, not stale leftovers.
function withLiveScore(match, liveMatches) {
  const live = liveMatches?.[match.id];
  if (!live) return match;
  return { ...match, score: live.score, liveStatus: live.status };
}

export default function App() {
  const [data, setData] = useState(null);
  const [lineups, setLineups] = useState(null);
  const [history, setHistory] = useState(null);
  const [odds, setOdds] = useState(null);
  const [liveScores, setLiveScores] = useState(null);
  const [matchStats, setMatchStats] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("standings");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedStatsMatch, setSelectedStatsMatch] = useState(null);

  const positionByTeamId = useMemo(() => {
    const map = {};
    for (const row of data?.standings ?? []) {
      map[row.team.id] = row.position;
    }
    return map;
  }, [data?.standings]);

  useEffect(() => {
    // Resolves null on any failure - the optional files may simply not
    // exist yet, and a failed refresh must keep showing whatever data is
    // already on screen rather than blanking it.
    const loadJson = (name) =>
      fetch(`${import.meta.env.BASE_URL}${name}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

    // Only data.json failing on the very first load is surfaced as an
    // error banner - without it there's no dashboard at all. Later
    // refreshes of it go through refreshData below and fail silently.
    fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));

    // Last-season history only changes monthly - fetching it once per
    // page load is plenty.
    loadJson("history.json").then(setHistory);

    const refreshData = () => loadJson("data.json").then((json) => json && setData(json));
    const refreshOptional = () => {
      loadJson("lineups.json").then((json) => json && setLineups(json));
      loadJson("odds.json").then((json) => json && setOdds(json));
      loadJson("match-stats.json").then((json) => json && setMatchStats(json));
    };
    refreshOptional();

    // How the dashboard stays fresh without a reload, in three layers:
    //
    // 1. live-scores.json is polled every 60s - it's the only file that
    //    changes mid-match (every ~5 min while something is live).
    // 2. When the set of live match ids changes - a kickoff or a full-time
    //    whistle - data.json/match-stats.json/odds.json are refetched
    //    immediately. This is exact, not hopeful: the workflow run that
    //    clears a finished match from live-scores.json refreshes data.json
    //    and match-stats.json in the same commit, so by the time the client
    //    can observe the transition, the refreshed files are already
    //    deployed alongside it. Without this, a finished match snapped
    //    back to an upcoming "VS" fixture (its live overlay gone, the
    //    page-load-time data.json still listing it as SCHEDULED) until the
    //    user manually reloaded.
    // 3. A slow 5-minute catch-all refresh of the same files, since
    //    odds/lineups/fixtures all change server-side every ~15 min even
    //    with nothing live, plus an immediate refresh whenever the tab
    //    becomes visible again (a phone that switched apps, a laptop that
    //    slept through full time).
    let prevLiveIds = null;
    const fetchLiveScores = () =>
      loadJson("live-scores.json").then((json) => {
        if (!json) return; // transient fetch failure - keep what we have
        setLiveScores(json);
        const ids = Object.keys(json.matches ?? {}).sort().join(",");
        if (prevLiveIds !== null && ids !== prevLiveIds) {
          refreshData();
          refreshOptional();
        }
        prevLiveIds = ids;
      });

    fetchLiveScores();
    const liveInterval = setInterval(fetchLiveScores, 60 * 1000);
    const slowInterval = setInterval(() => {
      refreshData();
      refreshOptional();
    }, 5 * 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLiveScores();
        refreshData();
        refreshOptional();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(liveInterval);
      clearInterval(slowInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        teamData={data?.teams?.[selectedTeam.id]}
        lineups={lineups?.lineups}
        history={history}
        onClose={() => setSelectedTeam(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-epl-bg pb-10">
      <header className="bg-epl-gradient text-white px-4 pt-4 pb-3 shadow-lg">
        <div className="max-w-2xl mx-auto space-y-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Premier League 2026-27</h1>
            {data && <LastUpdated fetchedAt={data.fetchedAt} />}
          </div>

          <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-950 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            Couldn&apos;t load data: {error}
          </div>
        )}

        {activeTab === "standings" && (
          <Section title="Standings">
            <StandingsTable standings={data?.standings} onSelectTeam={setSelectedTeam} />
          </Section>
        )}

        {activeTab === "fixtures" && (
          <Section title="Next Fixtures">
            {data?.nextFixtures?.length ? (
              <ul className="space-y-2">
                {data.nextFixtures.map((match) => {
                  const liveMatch = withLiveScore(match, liveScores?.matches);
                  return (
                    <MatchRow
                      key={match.id}
                      match={liveMatch}
                      showScore={Boolean(liveMatch.liveStatus)}
                      positions={positionByTeamId}
                      onSelectTeam={setSelectedTeam}
                      onSelectMatch={liveMatch.liveStatus ? undefined : setSelectedMatch}
                      odds={odds?.odds?.[match.id]}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-white/50">No upcoming fixtures.</p>
            )}
          </Section>
        )}

        {activeTab === "results" && (
          <Section title="Last Results">
            {data?.lastResults?.length ? (
              <ul className="space-y-2">
                {data.lastResults.map((match) => {
                  const liveMatch = withLiveScore(match, liveScores?.matches);
                  return (
                    <MatchRow
                      key={match.id}
                      match={liveMatch}
                      showScore={true}
                      positions={positionByTeamId}
                      onSelectTeam={setSelectedTeam}
                      onSelectMatch={liveMatch.liveStatus ? undefined : setSelectedStatsMatch}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-white/50">
                No results yet — the season hasn&apos;t kicked off.
              </p>
            )}
          </Section>
        )}

        {activeTab === "headlines" && (
          <Section title="Headlines">
            <Headlines headlines={data?.headlines} standings={data?.standings} />
          </Section>
        )}
      </main>

      {selectedMatch && (
        <MatchOddsDialog
          match={selectedMatch}
          odds={odds?.odds?.[selectedMatch.id]}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      {selectedStatsMatch && (
        <MatchStatsDialog
          match={selectedStatsMatch}
          stats={matchStats?.stats?.[selectedStatsMatch.id]?.stats}
          scorers={matchStats?.stats?.[selectedStatsMatch.id]?.scorers}
          onClose={() => setSelectedStatsMatch(null)}
        />
      )}
    </div>
  );
}
