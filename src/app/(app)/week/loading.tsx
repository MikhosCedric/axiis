import { CaptureBone, GridBone, SkeletonFrame } from "@/components/page-skeleton";

/** Shown while a week loads: the heading, the capture field and the seven columns of the time grid. */
export default function Loading() {
  return (
    <SkeletonFrame title="w-64">
      <CaptureBone />
      <div className="max-rail:hidden">
        <GridBone days={7} />
      </div>
      <div className="rail:hidden">
        <GridBone days={3} />
      </div>
    </SkeletonFrame>
  );
}
