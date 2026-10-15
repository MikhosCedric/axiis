import { Bone, CaptureBone, SkeletonFrame } from "@/components/page-skeleton";

/**
 * Shown while a day loads: the heading, the capture field, the hour axis and three staves, drawn in
 * the same hairlines and at the same sizes as the Score, so nothing jumps when the real page lands.
 */
export default function Loading() {
  return (
    <SkeletonFrame title="w-72">
      <CaptureBone />
      <div className="mt-10 border-y border-rule">
        <div className="flex h-8 border-b border-rule">
          <div className="w-20 flex-none border-r border-rule rail:w-[104px]" />
          <div className="flex-1 bg-[linear-gradient(to_right,var(--rule-soft)_1px,transparent_1px)] bg-[length:76px_100%]" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-[85px] border-b border-rule-soft last:border-b-0">
            <div className="w-20 flex-none border-r border-rule px-3 pt-4 rail:w-[104px]">
              <Bone className="h-4 w-14" />
            </div>
            <div className="flex-1 bg-[linear-gradient(to_right,var(--rule-soft)_1px,transparent_1px)] bg-[length:76px_100%]" />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}
