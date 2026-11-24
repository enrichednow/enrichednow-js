// Formulas, from the first estimate to a saved formula that runs every weekday.
//
// Run it with ENRICHEDNOW_API_KEY set, after `pnpm build`: `node examples/formulas.ts` (Node 23.6 or later), or
// `npx tsx examples/formulas.ts`. It spends units: a preview of at most 50, then a run capped at 2 000.
import { writeFile } from 'node:fs/promises';

import EnrichedNow, { AttestationRequiredError, FormulaRunFailedError, RunTimeoutError } from 'enrichednow';
import type { JobOrderHunterParams } from 'enrichednow';

/** The columns this example reads of a row of `job-order-hunter`. */
interface JobOrder {
  company_name: string;
  job_title: string;
  contact_email: string | null;
}

async function main(): Promise<void> {
  const client = new EnrichedNow(); // reads ENRICHEDNOW_API_KEY

  // A formula this library knows has a type for its parameters: a missing or misspelt one does not compile.
  const params: JobOrderHunterParams = {
    job_titles: ['Java Developer'],
    locations: ['London'],
    posted_within_days: 2,
    exclude_companies: ['Our Client Ltd'],
  };

  // What a run would cost. Free; parameters that cannot run answer `valid: false`, not an error.
  const { valid, errors, estimate } = await client.formulas.estimate('job-order-hunter', params, { unitCap: 2000 });
  if (!valid) {
    for (const problem of errors) console.log(problem.path, problem.message);
    return;
  }
  console.log(`About ${estimate?.expected_units} units, at most ${estimate?.max_units}.`);

  try {
    // A preview first: at most 10 rows and 50 units.
    const preview = await client.runFormula<'job-order-hunter', JobOrder>('job-order-hunter', params, { preview: true });
    for await (const row of preview.rows) console.log(row.score, row.data.company_name, row.data.job_title);

    // Then the real run, and its rows as one CSV file.
    const { run, rows, export: download } = await client.runFormula('job-order-hunter', params, { unitCap: 2000 });
    console.log(`${run.status}: ${run.rows_total} rows for ${run.units_spent} units`, run.reasons);
    await writeFile('job-orders.csv', download('csv'));

    // Tell it when a row is wrong: the company is matched to the right domain from now on.
    const first = await rows;
    if (first.data[0]) await client.formulaRows.feedback(first.data[0].id, 'wrong_company', { correctDomain: 'corvid.example' });
  } catch (error) {
    if (error instanceof AttestationRequiredError) {
      console.log(`An owner or an admin must first accept the ${error.kind} terms (version ${error.textVersion}) in the console.`);
      return;
    }
    if (error instanceof FormulaRunFailedError) {
      console.log(`The run ended ${error.status}: ${error.reason}`);
      return;
    }
    if (error instanceof RunTimeoutError) {
      await client.formulaRuns.cancel(error.runId); // or wait on: client.formulaRuns.wait(error.runId)
      return;
    }
    throw error;
  }

  // Keep companies you already work with out of every run.
  await client.suppressions.add([{ kind: 'domain', value: 'our-client.example' }]);
  const upload = await client.suppressions.upload('kind,value\nemail,ana@initech.example\ncompany_name,Umbrella Inc\n');
  console.log(`${upload.added} added, ${upload.already} already there`, upload.invalid);

  // Save it to run every weekday at 07:30 London time, at most 20 000 units a month.
  const saved = await client.savedFormulas.create('job-order-hunter', params, {
    schedule: { cadence: 'weekdays', local_time: '07:30', timezone: 'Europe/London' },
    monthlyUnitCap: 20_000,
    notify: 'digest',
  });
  console.log(saved.name, saved.schedule?.next_fire_at);

  // Each day, read what is new since the last read: a scheduled run delivers only rows it has not delivered before.
  const lastRead = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for await (const row of client.savedFormulas.rows<JobOrder>(saved.id, { since: lastRead })) {
    console.log(row.first_seen_at, row.data.company_name, row.data.contact_email);
  }

  // Change it: `null` removes the schedule.
  await client.savedFormulas.update(saved.id, { schedule: null });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
