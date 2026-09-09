import Section from "./Section.jsx";
import StandingsTable from "./StandingsTable.jsx";
import MatchRow from "./MatchRow.jsx";

// A single combined tab (league-phase table + upcoming fixtures + recent
// results) rather than three separate tabs like the Premier League gets -
// deliberately scoped down for this first pass: no odds, no lineups, no
// match-stats, no live-score overlay. Those can be layered on later the
// same way they were for the Premier League tabs, if wanted.
//
// Team clicks reuse the same TeamDetail as the Premier League tabs -
// most Champions League clubs aren't Premier League clubs and so have no
// squad data of ours, but TeamDetail already renders that gracefully
// ("Squad data not available" instead of a formation), and it's the right
// behavior for the many CL clubs that *are* also Premier League ones
// (Arsenal, Man City, ...): clicking them here shows the same real squad
// as clicking them from the Table/Fixtures/Results tabs would.
export default function ChampionsLeague({ data, onSelectTeam }) {
  return (
    <div className="space-y-4">
      <Section title="League Phase Table">
        <StandingsTable standings={data?.standings} onSelectTeam={onSelectTeam} showZones={false} />
      </Section>

      <Section title="Next Fixtures">
        {data?.nextFixtures?.length ? (
          <ul className="space-y-2">
            {data.nextFixtures.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                showScore={false}
                onSelectTeam={onSelectTeam}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/50">No upcoming fixtures.</p>
        )}
      </Section>

      <Section title="Recent Results">
        {data?.lastResults?.length ? (
          <ul className="space-y-2">
            {data.lastResults.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                showScore={true}
                onSelectTeam={onSelectTeam}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/50">No results yet.</p>
        )}
      </Section>
    </div>
  );
}
