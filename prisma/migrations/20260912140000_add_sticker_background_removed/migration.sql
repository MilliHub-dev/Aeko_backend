-- Whether a sticker's background was actually cut out.
--
-- Background removal is a paid Cloudinary add-on and is offered only to
-- subscribers, so a sticker made by a free user is a plain square crop. The
-- flag records which one a sticker is, so the picker can be honest about it and
-- an existing sticker could be re-processed later if its creator subscribes.
ALTER TABLE "stickers" ADD COLUMN "backgroundRemoved" BOOLEAN NOT NULL DEFAULT false;
