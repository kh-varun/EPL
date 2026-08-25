import { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));

    // Confirmed lineups are optional - the file may not exist yet, and a
    // failure here must never block the rest of the dashboard.
    fetch(`${import.meta.env.BASE_URL}lineups.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setLineups)
      .catch(() => setLineups(null));

    // Last-season history is likewise optional.
    fetch(`${import.meta.env.BASE_URL}history.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setHistory)
      .catch(() => setHistory(null));

    // So is Kalshi market data - a match simply may not have a listed
    // market yet, and that's a normal, expected state, not an error.
    fetch(`${import.meta.env.BASE_URL}odds.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setOdds)
      .catch(() => setOdds(null));

    // Match stats (shots, possession, etc.) are likewise optional - only
    // finished matches have them, and even then only once fetch-live-scores.mjs
    // has picked them up after full time.
    fetch(`${import.meta.env.BASE_URL}match-stats.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setMatchStats)
      .catch(() => setMatchStats(null));

    // Live scores are likewise optional - empty whenever nothing's kicked
    // off right now, which is most of the time. The backing file only
    // changes every ~10 min (while a match is live), but a tab left open
    // wouldn't otherwise ever see that - poll it on an interval too, so a
    // live score updates without the user having to reload the page.
    const fetchLiveScores = () =>
      fetch(`${import.meta.env.BASE_URL}live-scores.json`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then(setLiveScores)
        .catch(() => setLiveScores(null));

    fetchLiveScores();
    const liveScoresInterval = setInterval(fetchLiveScores, 60 * 1000);
    return () => clearInterval(liveScoresInterval);
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
