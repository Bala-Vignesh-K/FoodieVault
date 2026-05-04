import { ListScreen } from "../../src/ListScreen";

export default function Places() {
  return (
    <ListScreen
      title="Saved Places"
      subtitle="Restaurants & food spots to visit"
      type="place"
      emptyIcon="location"
      emptyTitle="No places yet"
      emptySub="Share a restaurant post from Instagram or YouTube to save it here"
      testIdPrefix="places"
    />
  );
}
