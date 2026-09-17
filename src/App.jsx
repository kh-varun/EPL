import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LastUpdated from "./components/LastUpdated.jsx";
import Section from "./components/Section.jsx";
import TabBar from "./components/TabBar.jsx";
import StandingsTable from "./components/StandingsTable.jsx";
import MatchRow from "./components/MatchRow.jsx";
import Headlines from "./components/Headlines.jsx";
import ChampionsLeague from "./components/ChampionsLeague.jsx";
import CompetitionToggle from "./components/CompetitionToggle.jsx";
import TeamFilter from "./components/TeamFilter.jsx";
import TeamDetail from "./components/TeamDetail.jsx";
import MatchOddsDialog from "./components/MatchOddsDialog.jsx";
import MatchStatsDialog from "./components/MatchStatsDialog.jsx";
import {
  TrophyIcon,
  CalendarIcon,
  WhistleIcon,
  NewspaperIcon,
  StarIcon,
} from "./components/icons.jsx";

const TABS = [
  { id: "standings", label: "Table", icon: TrophyIcon },
  { id: "fixtures", label: "Fixtures", icon: CalendarIcon },
  { id: "results", label: "Results", icon: WhistleIcon },
  { id: "champions-league", label: "UCL", icon: StarIcon },
  { id: "headlines", label: "News", icon: NewspaperIcon },
];

// The Standings, Fixtures, and Results tabs all show one competition's data
// at a time behind a small sub-tab toggle, rather than stacking all three -
// nextFixtures/lastResults hold every match for the season (see
// ALL_MATCHES in scripts/lib/football-data.mjs), so stacking every
// competition's full list in one scroll would mean a lot of scrolling
// before ever reaching the others' data. "EFL" here means the Championship
// specifically (competition code "ELC") - confirmed live via football-data.
// org's /v4/competitions that it's the only English Football League
// competition on this project's free plan, no League One/Two access.
const MATCH_COMPETITIONS = [
  { id: "PL", label: "Premier League" },
  { id: "CL", label: "Champions League" },
  { id: "ELC", label: "Championship" },
];

// Overlays a match with its live score/status when one's in progress -
// live-scores.json only ever holds entries for matches currently IN_PLAY
// or PAUSED, so any hit here is real live data, not stale leftovers.
function withLiveScore(match, liveMatches) {
  const live = liveMatches?.[match.id];
  if (!live) return match;
  return { ...match, score: live.score, liveStatus: live.status };
}

// Narrows a match list down to one team's matches (home or away) - null
// teamId means "All Teams", so the list passes through unfiltered.
function filterByTeam(matches, teamId) {
  if (!teamId) return matches;
  return matches?.filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId);
}

// Resolves null on any failure - the optional files may simply not exist
// yet, and a failed refresh must keep showing whatever data is already on
// screen rather than blanking it. Module-level since it only needs the
// build-time BASE_URL, not anything from component state - both the
// mount-time effect below and the manual refresh button share this one copy.
const loadJson = (name) =>
  fetch(`${import.meta.env.BASE_URL}${name}`, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

// Position map for one competition's standings - kept separate per
// competition rather than merged into one map, since the tables are
// unrelated (mixing them would show a team's rank in the wrong
// competition's context, or worse, collide if a team id were ever shared).
function positionMap(standings) {
  const map = {};
  for (const row of standings ?? []) {
    map[row.team.id] = row.position;
  }
  return map;
}

// Team list for a competition's Fixtures/Results team filter dropdown -
// its own standings already lists every one of its teams, regardless of
// recent results, so there's no need for a separate fetch.
function teamList(standings) {
  return (standings ?? []).map((row) => row.team);
}

export default function App() {
  const [data, setData] = useState(null);
  const [lineups, setLineups] = useState(null);
  const [history, setHistory] = useState(null);
  const [odds, setOdds] = useState(null);
  const [liveScores, setLiveScores] = useState(null);
  const [matchStats, setMatchStats] = useState(null);
  const [championsLeague, setChampionsLeague] = useState(null);
  const [championship, setChampionship] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("standings");
  const [standingsCompetition, setStandingsCompetition] = useState("PL");
  const [fixturesCompetition, setFixturesCompetition] = useState("PL");
  const [fixturesTeamId, setFixturesTeamId] = useState(null);
  const [resultsCompetition, setResultsCompetition] = useState("PL");
  const [resultsTeamId, setResultsTeamId] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedStatsMatch, setSelectedStatsMatch] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  // One lookup per competition id, used by the Standings/Fixtures/Results
  // tabs instead of a hardcoded PL/CL ternary each - adding the
  // Championship here (and any future competition) only means adding one
  // more entry, not touching every tab's render logic. `live: true` marks
  // the one competition with a live-score overlay, odds preview, and
  // match-stats click handler (live-scores.json/odds.json/match-stats.json
  // are all Premier-League-only by design - no live-score tracking or
  // odds for Champions League or Championship yet).
  const competitions = useMemo(
    () => ({
      PL: {
        label: "Premier League",
        standings: data?.standings,
        nextFixtures: data?.nextFixtures,
        lastResults: data?.lastResults,
        positions: positionMap(data?.standings),
        teams: teamList(data?.standings),
        live: true,
      },
      CL: {
        label: "Champions League",
        standings: championsLeague?.standings,
        nextFixtures: championsLeague?.nextFixtures,
        lastResults: championsLeague?.lastResults,
        positions: positionMap(championsLeague?.standings),
        teams: teamList(championsLeague?.standings),
        live: false,
      },
      ELC: {
        label: "Championship",
        standings: championship?.standings,
        nextFixtures: championship?.nextFixtures,
        lastResults: championship?.lastResults,
        positions: positionMap(championship?.standings),
        teams: teamList(championship?.standings),
        live: false,
      },
    }),
    [data, championsLeague, championship],
  );

  const refreshData = useCallback(
    () => loadJson("data.json").then((json) => json && setData(json)),
    [],
  );

  const refreshOptional = useCallback(() => {
    loadJson("lineups.json").then((json) => json && setLineups(json));
    loadJson("odds.json").then((json) => json && setOdds(json));
    loadJson("match-stats.json").then((json) => json && setMatchStats(json));
    // Champions League/Championship data is far slower-moving than
    // anything else here (no live-score tracking for either) - both ride
    // along on this same 5-minute/visibility-change/manual refresh rather
    // than needing their own polling layer.
    loadJson("champions-league.json").then((json) => json && setChampionsLeague(json));
    loadJson("championship.json").then((json) => json && setChampionship(json));
  }, []);

  // prevLiveIds needs to survive across renders (to compare "did the live
  // match set change since last poll") but shouldn't itself trigger a
  // re-render - a ref instead of state, shared between the interval below
  // and the manual refresh button so a manual click doesn't cause the next
  // scheduled poll to see a stale comparison value and refetch redundantly.
  const prevLiveIdsRef = useRef(null);

  const fetchLiveScores = useCallback(() => {
    return loadJson("live-scores.json").then((json) => {
      if (!json) return; // transient fetch failure - keep what we have
      setLiveScores(json);
      const ids = Object.keys(json.matches ?? {}).sort().join(",");
      if (prevLiveIdsRef.current !== null && ids !== prevLiveIdsRef.current) {
        refreshData();
        refreshOptional();
      }
      prevLiveIdsRef.current = ids;
    });
  }, [refreshData, refreshOptional]);

  // Manual "refresh" button (see LastUpdated) - unconditionally refetches
  // everything right now instead of waiting for the next 60s live-score
  // poll or 5-minute catch-all. Runs the same three calls as
  // onVisibilityChange below, just triggered by a click instead of the tab
  // becoming visible again.
  //
  // Two things had to be added on top of just calling those three fetches,
  // confirmed live as the actual reason a working button still read as
  // "not working": the underlying JSON is almost always unchanged between
  // polls (nothing to show), and these are small static files on a CDN, so
  // a real click's fetches can resolve in well under 100ms - faster than a
  // person can perceive the icon spin at all. A MIN_SPIN_MS floor makes the
  // spin actually visible regardless of how fast the network is, and
  // justRefreshed swaps the icon to a checkmark for a bit afterward as
  // positive confirmation the click did something, even when nothing in
  // the data itself visibly changed.
  const justRefreshedTimeoutRef = useRef(null);
  const MIN_SPIN_MS = 400;

  const handleManualRefresh = useCallback(async () => {
    if (justRefreshedTimeoutRef.current) clearTimeout(justRefreshedTimeoutRef.current);
    setJustRefreshed(false);
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchLiveScores(),
        refreshData(),
        refreshOptional(),
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
    } finally {
      setIsRefreshing(false);
      setJustRefreshed(true);
      justRefreshedTimeoutRef.current = setTimeout(() => setJustRefreshed(false), 1500);
    }
  }, [fetchLiveScores, refreshData, refreshOptional]);

  useEffect(() => {
    return () => {
      if (justRefreshedTimeoutRef.current) clearTimeout(justRefreshedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
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

    refreshOptional();

    // How the dashboard stays fresh without a reload, in four layers:
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
    // 4. A manual refresh button (handleManualRefresh) for a user who
    //    doesn't want to wait on any of the above - e.g. right after
    //    triggering a workflow_dispatch run by hand.
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
  }, [fetchLiveScores, refreshData, refreshOptional]);

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

  const activeStandingsCompetition = competitions[standingsCompetition];
  const activeFixturesCompetition = competitions[fixturesCompetition];
  const activeResultsCompetition = competitions[resultsCompetition];
  const fixturesList = filterByTeam(activeFixturesCompetition.nextFixtures, fixturesTeamId);
  const resultsList = filterByTeam(activeResultsCompetition.lastResults, resultsTeamId);

  return (
    <div className="min-h-screen bg-epl-bg pb-10">
      <header className="bg-epl-gradient text-white px-4 pt-4 pb-3 shadow-lg">
        <div className="max-w-2xl mx-auto space-y-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Premier League 2026-27</h1>
            {data && (
              <LastUpdated
                fetchedAt={data.fetchedAt}
                onRefresh={handleManualRefresh}
                isRefreshing={isRefreshing}
                justRefreshed={justRefreshed}
              />
            )}
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
          <div className="space-y-4">
            <CompetitionToggle
              options={MATCH_COMPETITIONS}
              value={standingsCompetition}
              onChange={setStandingsCompetition}
            />

            <Section title={`${activeStandingsCompetition.label} – Standings`}>
              <StandingsTable
                standings={activeStandingsCompetition.standings}
                onSelectTeam={setSelectedTeam}
                showZones={standingsCompetition === "PL"}
              />
            </Section>
          </div>
        )}

        {activeTab === "fixtures" && (
          <div className="space-y-4">
            <CompetitionToggle
              options={MATCH_COMPETITIONS}
              value={fixturesCompetition}
              onChange={(id) => {
                setFixturesCompetition(id);
                setFixturesTeamId(null);
              }}
            />
            <TeamFilter
              teams={activeFixturesCompetition.teams}
              value={fixturesTeamId}
              onChange={setFixturesTeamId}
            />

            <Section title={`${activeFixturesCompetition.label} – Fixtures`}>
              {fixturesList?.length ? (
                <ul className="space-y-2">
                  {fixturesList.map((match) => {
                    if (!activeFixturesCompetition.live) {
                      return (
                        <MatchRow
                          key={match.id}
                          match={match}
                          showScore={false}
                          positions={activeFixturesCompetition.positions}
                          onSelectTeam={setSelectedTeam}
                        />
                      );
                    }
                    const liveMatch = withLiveScore(match, liveScores?.matches);
                    return (
                      <MatchRow
                        key={match.id}
                        match={liveMatch}
                        showScore={Boolean(liveMatch.liveStatus)}
                        positions={activeFixturesCompetition.positions}
                        onSelectTeam={setSelectedTeam}
                        onSelectMatch={liveMatch.liveStatus ? undefined : setSelectedMatch}
                        odds={odds?.odds?.[match.id]}
                      />
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-white/50">
                  {fixturesTeamId ? "No upcoming fixtures for this team." : "No upcoming fixtures."}
                </p>
              )}
            </Section>
          </div>
        )}

        {activeTab === "results" && (
          <div className="space-y-4">
            <CompetitionToggle
              options={MATCH_COMPETITIONS}
              value={resultsCompetition}
              onChange={(id) => {
                setResultsCompetition(id);
                setResultsTeamId(null);
              }}
            />
            <TeamFilter
              teams={activeResultsCompetition.teams}
              value={resultsTeamId}
              onChange={setResultsTeamId}
            />

            <Section title={`${activeResultsCompetition.label} – Results`}>
              {resultsList?.length ? (
                <ul className="space-y-2">
                  {resultsList.map((match) => {
                    if (!activeResultsCompetition.live) {
                      return (
                        <MatchRow
                          key={match.id}
                          match={match}
                          showScore={true}
                          positions={activeResultsCompetition.positions}
                          onSelectTeam={setSelectedTeam}
                        />
                      );
                    }
                    const liveMatch = withLiveScore(match, liveScores?.matches);
                    return (
                      <MatchRow
                        key={match.id}
                        match={liveMatch}
                        showScore={true}
                        positions={activeResultsCompetition.positions}
                        onSelectTeam={setSelectedTeam}
                        onSelectMatch={liveMatch.liveStatus ? undefined : setSelectedStatsMatch}
                      />
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-white/50">
                  {resultsTeamId
                    ? "No results for this team."
                    : resultsCompetition === "PL"
                      ? "No results yet — the season hasn't kicked off."
                      : "No results yet."}
                </p>
              )}
            </Section>
          </div>
        )}

        {activeTab === "champions-league" && (
          <ChampionsLeague data={championsLeague} onSelectTeam={setSelectedTeam} />
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
