import { BulkImportWorkflow } from './_components/BulkImportWorkflow';

export default function AdminImportPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-5">
        <h2 className="font-serif text-[22px] md:text-[26px] leading-tight text-ink">
          Bulk import
        </h2>
        <p className="text-[12px] text-ink-3 mt-1">
          Template-driven CSV import for tasks. Up to 500 rows per batch · 1 MB
          maximum file size · missing tags get auto-created during commit.
        </p>
      </header>

      <BulkImportWorkflow />

      <p className="mt-6 text-[11px] text-ink-3 leading-relaxed">
        Each commit records a single &lsquo;bulk_import&rsquo; audit row capturing
        the attempted, created, and skipped counts. Per-task activity entries
        annotate the source as <code className="font-mono">bulk_import</code>.
      </p>
    </div>
  );
}
