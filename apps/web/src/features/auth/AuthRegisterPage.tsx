import AuthCard from './components/AuthCard';
import AuthRegisterForm from './components/register/AuthRegisterForm';

export default function AuthRegisterPage() {
  return (
    <AuthCard screen="signUp">
      <AuthRegisterForm />
    </AuthCard>
  );
}
