import { Suspense } from "react";
import LoadingState from "./LoadingState";

export default function SuspenseBoundary({ children, variant = "cards" }) {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto py-8"><LoadingState variant={variant} /></div>}>
      {children}
    </Suspense>
  );
}
