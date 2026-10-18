import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import GodSamlField from './GodSamlField';
import GodSsoOnlySetting from './GodSsoOnlySetting';
import type { GodSamlForm } from '../../hooks/useGodSamlForm';

// The instance's SAML 2.0 identity provider (Okta, Entra ID, ADFS, Keycloak, Authentik).
// Its metadata is pasted or fetched from a URL on save; what this instance tells the
// provider is shown for copying.
export default function GodSamlSettings({
  form,
  hasOtherSsoProvider,
}: {
  form: GodSamlForm;
  hasOtherSsoProvider: boolean;
}) {
  const t = useTranslations('god.authProvider');
  const { settings } = form;

  return (
    <SettingsSection
      title={t('saml')}
      description={t(form.hasMetadata ? 'samlConfigured' : 'samlMissing')}
      action={
        <EnabledSwitch
          checked={form.enabled}
          onChange={form.setEnabled}
          disabled={form.saving || !form.hasMetadata}
        />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="saml-metadata-url">{t('samlMetadataUrl')}</Label>
          <Input
            id="saml-metadata-url"
            type="url"
            value={form.metadataUrl}
            onChange={(e) => form.setMetadataUrl(e.target.value)}
            placeholder="https://idp.example.com/saml/metadata"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t('samlMetadataUrlHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="saml-metadata-xml">{t('samlMetadataXml')}</Label>
          <Textarea
            id="saml-metadata-xml"
            dir="ltr"
            className="min-h-28 font-mono text-xs"
            value={form.metadataXml}
            onChange={(e) => form.setMetadataXml(e.target.value)}
            placeholder={
              settings.hasIdpMetadata ? t('samlMetadataStored') : '<md:EntityDescriptor …>'
            }
          />
          <p className="text-xs text-muted-foreground">
            {settings.hasIdpMetadata
              ? t('samlMetadataSummary', {
                  entityId: settings.idpEntityId,
                  ssoUrl: settings.idpSsoUrl,
                })
              : t('samlMetadataXmlHint')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <GodSamlField
            id="saml-label"
            label={t('oidcLabel')}
            value={form.label}
            onChange={form.setLabel}
            placeholder={t('samlLabelPlaceholder')}
            hint={t('oidcLabelHint')}
            maxLength={60}
          />
          <GodSamlField
            id="saml-entity-id"
            label={t('samlEntityId')}
            value={form.entityId}
            onChange={form.setEntityId}
            placeholder={settings.defaultEntityId}
            hint={t('samlEntityIdHint')}
          />
          <GodSamlField
            id="saml-email-attribute"
            label={t('samlEmailAttribute')}
            value={form.emailAttribute}
            onChange={form.setEmailAttribute}
            placeholder="email"
            hint={t('samlEmailAttributeHint')}
          />
          <GodSamlField
            id="saml-name-attribute"
            label={t('samlNameAttribute')}
            value={form.nameAttribute}
            onChange={form.setNameAttribute}
            placeholder="displayName"
            hint={t('samlNameAttributeHint')}
          />
        </div>

        <CopyableValue
          title={t('samlAcsUrl')}
          value={settings.acsUrl}
          hint={t('samlAcsUrlHint')}
          copyLabel={t('copySamlAcsUrl')}
        />
        <CopyableValue
          title={t('samlSpEntityId')}
          value={settings.entityId || settings.defaultEntityId}
          copyLabel={t('copySamlSpEntityId')}
        />
        <CopyableValue
          title={t('samlSpMetadataUrl')}
          value={settings.spMetadataUrl}
          hint={t('samlSpMetadataUrlHint')}
          copyLabel={t('copySamlSpMetadataUrl')}
        />
      </SettingsCard>

      <GodSsoOnlySetting
        form={form}
        available={hasOtherSsoProvider || (form.enabled && form.hasMetadata)}
      />
    </SettingsSection>
  );
}
