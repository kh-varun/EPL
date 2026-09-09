import Section from "./Section.jsx";
import StandingsTable from "./StandingsTable.jsx";

// Standings-only: this competition's upcoming fixtures and recent results
// live in the main Fixtures/Results tabs instead (grouped alongside the
// Premier League's own), so they aren't duplicated here.
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
    <Section title="League Phase Table">
      <StandingsTable standings={data?.standings} onSelectTeam={onSelectTeam} showZones={false} />
    </Section>
  );
}
