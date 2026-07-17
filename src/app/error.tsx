"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-red-400/20 bg-card/90">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <div className="rounded-full border border-red-400/20 bg-red-400/10 p-3 text-red-300">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Dashboard feed unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Stack Overlord could not load the pipeline ledger. Retry the request or
              check the Postgres connection.
            </p>
          </div>
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
