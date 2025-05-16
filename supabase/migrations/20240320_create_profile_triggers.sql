-- First ensure the update_timestamp function exists (if not already created)
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, wallet_address)
    VALUES (
        NEW.id,
        CASE 
            WHEN NEW.raw_user_meta_data->>'wallet_address' IS NOT NULL THEN 
                NEW.raw_user_meta_data->>'wallet_address'
            ELSE 
                REPLACE(NEW.email, '@wallet.yomama', '') -- Extract wallet address from email
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user(); 