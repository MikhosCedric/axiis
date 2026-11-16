import { CaptureBone, GridBone, SkeletonFrame } from "@/components/page-skeleton";

/** Shown while a day loads: the heading, the capture field and one column of the time grid. */
export default function Loading() {
  return (
    <SkeletonFrame title="w-72">
      <CaptureBone />
      <GridBone days={1} />
    </SkeletonFrame>
  );
}
