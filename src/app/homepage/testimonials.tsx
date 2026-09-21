"use client";

import { StarIcon } from "lucide-react";

const reviews = [
  { quote: "I love how easy it was to create my resume!", name: "Anna G.", role: "Marketing Analyst" },
  { quote: "Best resume builder I've tried so far.", name: "Tom H.", role: "Software Engineer" },
  { quote: "The templates look fantastic and professional.", name: "Lisa K.", role: "Product Designer" },
  { quote: "It helped me land three interviews in a week!", name: "James R.", role: "Sales Associate" },
  { quote: "Very intuitive and fast. Highly recommended.", name: "Karen T.", role: "Nurse" },
  { quote: "My resume finally stands out thanks to Kaizo.", name: "Mark V.", role: "Data Analyst" },
  { quote: "Clean design and simple to use.", name: "Nina B.", role: "Recent Graduate" },
  { quote: "I had my resume ready in 10 minutes!", name: "Oscar W.", role: "Project Manager" },
  { quote: "I got compliments on my resume format.", name: "Dana P.", role: "HR Coordinator" },
  { quote: "An essential tool for job seekers.", name: "Sam C.", role: "Accountant" },
];

function Card({ review }: { review: (typeof reviews)[number] }) {
  return (
    <div className="flex-shrink-0 w-80 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex gap-0.5 mb-3 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} className="w-4 h-4 fill-current" />
        ))}
      </div>
      <p className="mb-4 text-gray-700">“{review.quote}”</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-indigo-500 text-white flex items-center justify-center text-sm font-bold">
          {review.name[0]}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">{review.name}</p>
          <p className="text-xs text-gray-500">{review.role}</p>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="w-full py-20 px-4 bg-sky-50 overflow-hidden">
      <h2 className="text-4xl font-extrabold text-center mb-3 tracking-tight text-gray-900">
        Loved by job seekers
      </h2>
      <p className="text-center text-gray-600 mb-10">
        See what people say after building their resume with Kaizo.
      </p>
      <div className="relative w-full">
        <div className="flex w-max animate-marquee gap-4">
          {[...reviews, ...reviews].map((review, i) => (
            <Card key={i} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
