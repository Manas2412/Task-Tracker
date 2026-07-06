-- H-6: Add sort order column for within-lane reorder on JS Priority Board
ALTER TABLE "tasks" ADD COLUMN "js_priority_sort_order" INTEGER;
