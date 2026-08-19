import {
  AccountOutlineIcon,
  GlobalSettingsLabel,
} from "@renderer/components/atoms";

export const GlobalSettingsProfileForm = () => {
  return (
    <div className="space-y-8">
      <section>
        <GlobalSettingsLabel
          id="profile"
          label="Персонализация"
          description="Настройки профиля"
          keywords={["профиль", "персонализация"]}
          icon={AccountOutlineIcon}
          level="form"
        />
        ывыфвывыв
      </section>
    </div>
  );
};
