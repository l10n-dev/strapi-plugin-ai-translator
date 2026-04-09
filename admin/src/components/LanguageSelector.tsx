import { SingleSelect, SingleSelectOption } from "@strapi/design-system";
import { useIntl } from "react-intl";
import { getTrad } from "../utils/getTrad";

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

interface LanguageSelectorProps {
  locales: Locale[];
  value: string;
  onChange: (locale: string) => void;
  disabled?: boolean;
}

export const LanguageSelector = ({
  locales,
  value,
  onChange,
  disabled,
}: LanguageSelectorProps) => {
  const { formatMessage } = useIntl();

  const nonDefaultLocales = locales.filter((l) => !l.isDefault);

  return (
    <SingleSelect
      placeholder={formatMessage({
        id: getTrad("dashboard.targetLanguage"),
        defaultMessage: "Target language",
      })}
      value={value}
      onChange={(val: string | number) => onChange(String(val))}
      disabled={disabled}
      size="S"
    >
      {nonDefaultLocales.map((locale) => (
        <SingleSelectOption key={locale.code} value={locale.code}>
          {locale.name}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
};
