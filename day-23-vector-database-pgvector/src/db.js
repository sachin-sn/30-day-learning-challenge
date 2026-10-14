import pg from "pg";

// Test values only: matches the docker run command in challenge.md.
export const pool = new pg.Pool({
  host: "localhost",
  port: 5433,
  user: "postgres",
  password: "test",
  database: "postgres",
});

// JS array -> pgvector text format, e.g. "[0.1,0.2,...]"
export const toVector = (arr) => `[${arr.join(",")}]`;
