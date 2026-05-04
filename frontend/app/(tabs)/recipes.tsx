import { ListScreen } from "../../src/ListScreen";

export default function Recipes() {
  return (
    <ListScreen
      title="Saved Recipes"
      subtitle="Cook when inspiration strikes"
      type="recipe"
      emptyIcon="restaurant"
      emptyTitle="No recipes yet"
      emptySub="Share a cooking video and we'll extract the ingredients & steps"
      testIdPrefix="recipes"
    />
  );
}
