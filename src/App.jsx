import { useEffect, useState } from "react";
import LastUpdated from "./components/LastUpdated.jsx";
import Section from "./components/Section.jsx";
import TabBar from "./components/TabBar.jsx";
import StandingsTable from "./components/StandingsTable.jsx";
import MatchRow from "./components/MatchRow.jsx";
import Headlines from "./components/Headlines.jsx";
import TeamDetail from "./components/TeamDetail.jsx";
import { TrophyIcon, CalendarIcon, WhistleIcon, NewspaperIcon } from "./components/icons.jsx";

const TABS = [
  { id: "standings", label: "Table", icon: TrophyIcon },
  { id: "fixtures", label: "Fixtures", icon: CalendarIcon },
  { id: "results", label: "Results", icon: WhistleIcon },
  { id: "headlines", label: "News", icon: NewspaperIcon },
];

export default function App() {
  const [data, setData] = useState(null);
  const [lineups, setLineups] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("standings");
  const [selectedTeam, setSelectedTeam] = useState(null);

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
                {data.nextFixtures.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    showScore={false}
                    onSelectTeam={setSelectedTeam}
                  />
                ))}
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
                {data.lastResults.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    showScore={true}
                    onSelectTeam={setSelectedTeam}
                  />
                ))}
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
    </div>
  );
}
