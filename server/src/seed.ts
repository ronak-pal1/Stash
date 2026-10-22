import { connectDb, disconnectDb } from "./config/db.js";
import { BUILT_IN_TEMPLATES, DEFAULT_FOLDERS } from "./data/defaults.js";
import { Folder } from "./models/folder.model.js";
import { Note } from "./models/note.model.js";
import { Template } from "./models/template.model.js";
import { User } from "./models/user.model.js";
import { Workspace } from "./models/workspace.model.js";
import { ensureBuiltInTemplates } from "./services/template.service.js";
import { docFlags, plainTextFromDoc, readingMinutes, wordCountOf, type JSONContent } from "./utils/content.js";

const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const heading = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const quote = (text: string): JSONContent => ({ type: "blockquote", content: [paragraph(text)] });
const tasks = (items: string[]): JSONContent => ({
  type: "taskList",
  attrs: { columns: 2 },
  content: items.map((text) => ({ type: "taskItem", attrs: { checked: false }, content: [paragraph(text)] })),
});

const samples: Array<{ title: string; emoji: string; folder: string; tags: string[]; location?: string; content: JSONContent; minutesAgo: number }> = [
  {
    title: "Grocery list / Stores",
    emoji: "",
    folder: "Notes",
    tags: [],
    location: "San Francisco, CA",
    minutesAgo: 1,
    content: { type: "doc", content: [paragraph("Bread Flour · Instant Dry Yeast · Extra-virgin Olive Oil, 5 banana shallots · 4 garlic cloves.")] },
  },
  {
    title: "Books to read",
    emoji: "🌶️",
    folder: "Notes",
    tags: [],
    minutesAgo: 5,
    content: { type: "doc", content: [paragraph("Cheers to the books we've been meaning to read all these years and should probably start at some point.")] },
  },
  {
    title: "Write down your ideas",
    emoji: "💡",
    folder: "Notes",
    tags: ["ideas", "to-do's", "morning"],
    minutesAgo: 60 * 24,
    content: {
      type: "doc",
      content: [
        heading(1, "Write down your ideas"),
        paragraph("#ideas #to-do's #morning"),
        quote("Sometimes, on Mondays, when servers at A16 are announcing the specials, you can almost feel the excitement at the table when the waiters say, 'And of course, since it's Monday … we have meatballs' says Shelley Lingren."),
        heading(3, "Morning"),
        tasks(["setup meeting with Rachel", "check to-dos", "apply at Braintree", "check reservations"]),
      ],
    },
  },
  {
    title: "Curried Carrot Soup",
    emoji: "",
    folder: "Notes",
    tags: ["recipes", "savory"],
    minutesAgo: 60 * 24 * 2,
    content: { type: "doc", content: [paragraph("#recipes/savory #recipessavorymains Curried Carrot and Fennel Soup with Turmeric and Orange.")] },
  },
];

const run = async () => {
  await connectDb();
  await ensureBuiltInTemplates();
  const email = "ada@stash.test";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Seed user already exists: ${email} / password123`);
    await disconnectDb();
    return;
  }
  const user = await User.create({ name: "Ada Lovelace", email, password: "password123", plan: "pro" });
  const workspace = await Workspace.create({
    name: "Personal",
    ownerId: user._id,
    icon: "notebook",
    members: [{ userId: user._id, role: "owner", email: user.email, name: user.name }],
  });
  const folders = await Folder.insertMany(
    DEFAULT_FOLDERS.map((folder, index) => ({
      workspaceId: workspace._id,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      position: index,
      createdBy: user._id,
    })),
  );
  const folderId = (name: string) => folders.find((folder) => folder.name === name)?._id ?? null;
  for (const sample of samples) {
    const plain = plainTextFromDoc(sample.content);
    const flags = docFlags(sample.content);
    const updatedAt = new Date(Date.now() - sample.minutesAgo * 60 * 1000);
    const created = await Note.create({
      workspaceId: workspace._id,
      folderId: folderId(sample.folder),
      ownerId: user._id,
      title: sample.title,
      emoji: sample.emoji,
      content: sample.content,
      plainText: plain,
      tags: sample.tags,
      locationLabel: sample.location ?? null,
      wordCount: wordCountOf(plain),
      readingMinutes: readingMinutes(plain),
      ...flags,
    });
    await Note.collection.updateOne({ _id: created._id }, { $set: { createdAt: updatedAt, updatedAt } });
  }
  console.log(`Seeded ${email} / password123`);
  console.log(`Templates: ${(await Template.countDocuments({ isBuiltIn: true })) || BUILT_IN_TEMPLATES.length}`);
  await disconnectDb();
};

run().catch(async (error: unknown) => {
  console.error(error);
  await disconnectDb();
  process.exit(1);
});
