// src/components/profile/ContactInfoSection.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, Plus, X } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import { useProfile } from "@/context/profileContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import PhotoPicker from "../photoPicker";
import PickSelect from "../pickSelect";
import { loadGeo, regionLabel, type Geo } from "@/lib/geo";
import { formatPhoneInput, phoneExample } from "@/lib/phone";
import { realName } from "@/lib/previewData";
import { US_STATES, fullState } from "@/lib/place";
import { useT, useLocale } from "@/i18n/provider";
import { countryNamer } from "@/i18n/places";

/** Splits a full name into first names and the last name (a single word is only a first name). */
function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] ?? "", ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

/**
 * Contact details, edited the same way as in the step-by-step builder: every change goes straight to the profile
 * (so the live preview next to it follows along) and is saved with "Save changes".
 */
const ContactInfoSection: React.FC = () => {
  const { tr } = useT();
  const { activeProfile: profile, updateContactInfo, updateName, updatePhoto } = useProfile();
  const c = profile.contactInfo;
  const countryCode = c.countryCode || "US";
  const country = c.country || "United States";

  // first / last name; the profile keeps the full name
  const [first, setFirst] = useState(() => splitName(realName(profile.name))[0]);
  const [last, setLast] = useState(() => splitName(realName(profile.name))[1]);
  const lastWritten = useRef([first, last].filter(Boolean).join(" "));
  useEffect(() => {
    // while the person is typing in these fields, what they type is what counts (clearing one must not bring the old name back)
    const typing = typeof document !== "undefined" && ["first-name", "last-name"].includes(document.activeElement?.id ?? "");
    if (typing) return;
    const full = realName(profile.name);
    if (full !== lastWritten.current) {
      // the profile changed from elsewhere (for example a re-read of the resume)
      const [f, l] = splitName(full);
      setFirst(f);
      setLast(l);
      lastWritten.current = full;
    }
  }, [profile.name]);
  const setNameParts = (f: string, l: string) => {
    setFirst(f);
    setLast(l);
    const full = [f.trim(), l.trim()].filter(Boolean).join(" ");
    lastWritten.current = full;
    updateName(full);
  };

  const [geo, setGeo] = useState<Geo | null>(null);
  const locale = useLocale();
  const countryShown = React.useMemo(() => countryNamer(locale, geo?.countries), [locale, geo]);
  useEffect(() => {
    loadGeo().then(setGeo).catch(() => {});
  }, []);
  const regions = geo ? geo.regionsOf(countryCode) : countryCode === "US" ? US_STATES : [];
  const state = countryCode === "US" ? fullState(c.state || "") : c.state || "";

  const [showAdditionalEmails, setShowAdditionalEmails] = useState((c.additionalEmails?.length ?? 0) > 0);
  const [showAdditionalPhones, setShowAdditionalPhones] = useState((c.additionalPhones?.length ?? 0) > 0);
  const emails = c.additionalEmails ?? [];
  const phones = c.additionalPhones ?? [];

  return (
    <motion.div className="space-y-6">
      {/* two groups side by side on wide screens, each one compact: what you write is short, so the fields are too */}
      <div className="grid gap-x-14 gap-y-10 xl:grid-cols-2">
        <section className="space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{tr("About you")}</h3>
          {/* Photo (optional): templates adjust when there is one */}
          <PhotoPicker value={profile.photo || ""} onChange={updatePhoto} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">{tr("First name *")}</Label>
              <Input id="first-name" value={first} onChange={(e) => setNameParts(e.target.value, last)} placeholder={tr("Alex")} name="given-name" autoComplete="given-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">{tr("Last name")}</Label>
              <Input id="last-name" value={last} onChange={(e) => setNameParts(first, e.target.value)} placeholder={tr("Johnson")} name="family-name" autoComplete="family-name" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
            <div className="space-y-2">
              <Label htmlFor="email">{tr("Email *")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={c.email || ""} onChange={(e) => updateContactInfo({ email: e.target.value })} className="pl-10" placeholder={tr("alex@email.com")} name="email" autoComplete="email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tr("Phone *")}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={c.phone || ""}
                  onChange={(e) => updateContactInfo({ phone: formatPhoneInput(e.target.value, countryCode) })}
                  className="pl-10"
                  placeholder={phoneExample(countryCode)}
                  name="tel"
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{tr("Where you live")}</h3>
          <div className="space-y-2">
            <Label htmlFor="address">{tr("Street address")}</Label>
            <Input id="address" value={c.address || ""} onChange={(e) => updateContactInfo({ address: e.target.value })} placeholder={tr("123 Main St")} name="address-line1" autoComplete="address-line1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">{tr("City")}</Label>
              <Input id="city" value={c.city || ""} onChange={(e) => updateContactInfo({ city: e.target.value })} placeholder={tr("Springfield")} name="address-level2" autoComplete="address-level2" />
            </div>
            {regions.length > 0 ? (
              <div className="space-y-2">
                <Label>{regionLabel(countryCode, tr)}</Label>
                <PickSelect value={state} onChange={(v) => updateContactInfo({ state: v })} options={regions} label={regionLabel(countryCode, tr)} name="address-level1" placeholder={tr("Choose a {v0}", { v0: regionLabel(countryCode, tr).toLowerCase() })} />
              </div>
            ) : (
              <div />
            )}
          </div>
          <div className="space-y-2 sm:max-w-sm">
            <Label>{tr("Country")}</Label>
            <PickSelect
              value={country}
              onChange={(name) => {
                const g = geo?.countries.find((x) => x.name === name);
                if (!g || g.isoCode === countryCode) return;
                // the regions belong to the old country; the phone keeps its digits in the new country's look
                updateContactInfo({ country: g.name, countryCode: g.isoCode, state: "", phone: formatPhoneInput((c.phone || "").replace(/[^\d+]/g, ""), g.isoCode) });
              }}
              options={geo ? geo.countries.map((x) => x.name) : [country]}
                  display={countryShown}
              label={tr("Country")}
              name="country-name"
              placeholder={tr("Choose a country")}
              leading={(n) => {
                const iso = (geo?.countries.find((x) => x.name === n)?.isoCode ?? (n === country ? countryCode : "")).toLowerCase();
                return iso ? <span className={`fi fi-${iso} h-4 w-6 rounded-[3px] shadow-sm ring-1 ring-black/10`} aria-hidden /> : null;
              }}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-x-14 gap-y-6 xl:grid-cols-2">
      {/* Additional emails */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{tr("Additional email addresses")}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdditionalEmails((v) => !v)}>
            {showAdditionalEmails ? tr("Hide") : tr("Show")}
          </Button>
        </div>
        {showAdditionalEmails && (
          <div className="space-y-2">
            {emails.map((email, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateContactInfo({ additionalEmails: emails.map((x, j) => (j === i ? e.target.value : x)) })}
                    className="pl-10"
                    placeholder={tr("other.email@example.com")}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => updateContactInfo({ additionalEmails: emails.filter((_, j) => j !== i) })} className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => updateContactInfo({ additionalEmails: [...emails, ""] })}>
              <Plus className="mr-2 h-4 w-4" />{" "}{tr("Add email")}</Button>
          </div>
        )}
      </div>

      {/* Additional phones */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{tr("Additional phone numbers")}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdditionalPhones((v) => !v)}>
            {showAdditionalPhones ? tr("Hide") : tr("Show")}
          </Button>
        </div>
        {showAdditionalPhones && (
          <div className="space-y-2">
            {phones.map((phone, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => updateContactInfo({ additionalPhones: phones.map((x, j) => (j === i ? formatPhoneInput(e.target.value, countryCode) : x)) })}
                    className="pl-10"
                    placeholder={phoneExample(countryCode)}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => updateContactInfo({ additionalPhones: phones.filter((_, j) => j !== i) })} className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => updateContactInfo({ additionalPhones: [...phones, ""] })}>
              <Plus className="mr-2 h-4 w-4" />{" "}{tr("Add phone")}</Button>
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
};

export default ContactInfoSection;
