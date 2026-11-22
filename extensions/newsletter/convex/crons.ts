import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Per-visitor rows only serve "once a day"; the counts live on in `daily`.
crons.interval("clear old visits", { hours: 6 }, internal.analytics.purgeVisits, {});

export default crons;
