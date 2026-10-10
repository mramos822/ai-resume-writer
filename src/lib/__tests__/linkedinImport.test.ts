import { parseCsv, readLinkedIn, mergeLinkedIn, toMonth } from "../linkedinImport";
import type { ProfileData } from "@/context/profileContext";

const empty = (): ProfileData => ({
    name: "",
    jobTitle: "",
    careerObjective: "",
    skills: [],
    jobHistory: [],
    education: [],
    internships: [],
    projects: [],
    contactInfo: { email: "", phone: "", address: "" },
});

describe("LinkedIn import", () => {
    it("reads quoted CSV fields with commas and line breaks", () => {
        const rows = parseCsv('Company Name,Title,Description\n"Acme, Inc.",Dev,"Built things\n- one\n- two"\n');
        expect(rows).toHaveLength(1);
        expect(rows[0]["Company Name"]).toBe("Acme, Inc.");
        expect(rows[0]["Description"]).toContain("- two");
    });

    it("turns LinkedIn dates into months", () => {
        expect(toMonth("Jan 2020")).toBe("2020-01");
        expect(toMonth("2019")).toBe("2019-01");
        expect(toMonth("")).toBe("");
    });

    it("builds profile data from the files", () => {
        const data = readLinkedIn({
            "profile.csv": "First Name,Last Name,Headline,Summary,Geo Location\nSam,Lee,Developer,Hello there,\"Newark, New Jersey, United States\"\n",
            "positions.csv": "Company Name,Title,Description,Location,Started On,Finished On\nAcme,Engineer,- Built an API,Remote,Mar 2021,\n",
            "skills.csv": "Name\nPython\nSQL\n",
        });
        expect(data.name).toBe("Sam Lee");
        expect(data.jobHistory?.[0]).toMatchObject({ company: "Acme", current: true, startDate: "2021-03", accomplishments: ["Built an API"] });
        expect(data.skills).toEqual(["Python", "SQL"]);
        expect(data.contactInfo).toMatchObject({ city: "Newark", state: "New Jersey", country: "United States" });
    });

    it("adds to a profile without replacing what the person wrote", () => {
        const base = { ...empty(), name: "Samuel Lee", skills: ["python"], jobHistory: [{ id: "1", company: "Acme", title: "Engineer", description: "", startDate: "2021-03", endDate: "", accomplishments: ["Mine"] }] };
        const inc = readLinkedIn({
            "profile.csv": "First Name,Last Name,Headline,Summary,Geo Location\nSam,Lee,Developer,Hi,\n",
            "positions.csv": "Company Name,Title,Description,Location,Started On,Finished On\nAcme,Engineer,- Other,,Mar 2021,\nBeta,Analyst,,,Jan 2019,Dec 2020\n",
            "skills.csv": "Name\nPython\nSQL\n",
        });
        const { data, added } = mergeLinkedIn(base, inc);
        expect(data.name).toBe("Samuel Lee");
        expect(data.jobHistory).toHaveLength(2);
        expect(data.jobHistory[0].accomplishments).toEqual(["Mine"]);
        expect(data.skills).toEqual(["python", "SQL"]);
        expect(added).toMatchObject({ jobs: 1, skills: 1 });
    });
});
