/** In a search by place, how far a job is from it. The results are shown in this order: in the place, near it, the nearest big city, remote, the rest. */
export const REACH_ORDER = ["here", "near", "city", "remote", "other"] as const;
export type Reach = (typeof REACH_ORDER)[number];
