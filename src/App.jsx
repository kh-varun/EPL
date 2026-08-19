import { useEffect, useState } from "react";
import LastUpdated from "./components/LastUpdated.jsx";
import Section from "./components/Section.jsx";
import StandingsTable from "./components/StandingsTable.jsx";
import MatchRow from "./components/MatchRow.jsx";
import Headlines from "./components/Headlines.jsx";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-epl-purple text-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-extrabold tracking-tight">Premier League 2026-27</h1>
          <p className="text-xs text-white/70">Standings · Fixtures · Headlines</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Couldn't load data: {error}
          </div>
        )}

        {data && <LastUpdated fetchedAt={data.fetchedAt} />}

        <Section title="Standings">
          <StandingsTable standings={data?.standings} />
        </Section>

        <Section title="Next Fixtures">
          {data?.nextFixtures?.length ? (
            <ul>
              {data.nextFixtures.map((match) => (
                <MatchRow key={match.id} match={match} showScore={false} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-epl-purple/60">No upcoming fixtures.</p>
          )}
        </Section>

        <Section title="Last Results">
          {data?.lastResults?.length ? (
            <ul>
              {data.lastResults.map((match) => (
                <MatchRow key={match.id} match={match} showScore={true} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-epl-purple/60">
              No results yet — the season hasn't kicked off.
            </p>
          )}
        </Section>

        <Section title="Headlines">
          <Headlines headlines={data?.headlines} />
        </Section>
      </main>
    </div>
  );
}
