CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
