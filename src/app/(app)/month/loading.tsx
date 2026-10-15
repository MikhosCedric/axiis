import { Bone, CaptureBone, SkeletonFrame } from "@/components/page-skeleton";

/** Shown while a month loads: the heading, the capture field, weekday heads and five ruled weeks, as the Month draws them. */
export default function Loading() {
  return (
    <SkeletonFrame title="w-56">
      <CaptureBone />
      <div className="@container/month mt-9">
        <div className="grid grid-cols-7 border-t border-l border-rule">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h${i}`} className="border-r border-b border-rule px-1 py-2 @min-[36rem]/month:px-2">
              <Bone className="mx-auto h-2.5 w-5 @min-[36rem]/month:mx-0 @min-[36rem]/month:w-7" />
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="min-h-14 border-r border-b border-rule px-1 pt-2 @min-[36rem]/month:min-h-28">
              <Bone className="mx-auto h-3 w-4 @min-[36rem]/month:mx-0" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}
